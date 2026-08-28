import { createHash, randomUUID } from "node:crypto";
import type { JSONValue, Sql } from "postgres";
import { sanitizeProviderDiagnostic, type ProviderDiagnostic } from "../foxit/esign-adapter";

export class ESignDispatchStore {
  constructor(private readonly sql: Sql) {}

  async enqueue(input: { workflowId: string; tenantId: string; expectedReviewDigest: string; artifactBytes: Uint8Array; operationId: string; now: Date }) {
    return this.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${input.operationId},0))`;
      const prior=await tx<Array<{dispatch_id:string;idempotency_key:string;document_sha256:string;status:"pending"|"processing"|"sent"|"reconcile"|"denied"}>>`select dispatch_id,idempotency_key,document_sha256,status from esign_dispatches where provider_operation_id=${input.operationId}`;
      if(prior[0])return{dispatchId:prior[0].dispatch_id,idempotencyKey:prior[0].idempotency_key,documentSha256:prior[0].document_sha256,status:prior[0].status};
      const operations=await tx<Array<{request_digest:string}>>`select request_digest from provider_operations where operation_id=${input.operationId} and tenant_id=${input.tenantId} and operation_kind='esign-dispatch' and state='reserved' for update`;
      if(!operations[0])throw new Error("A reserved eSign provider operation is required");
      const rows = await tx<Array<{ state: string; active_approval_id: string; approval_digest: string; review_digest: string; expires_at: Date; invalidated_at: Date | null; consumed_at: Date | null; artifact_sha256: string }>>`
        select w.state, w.active_approval_id, a.approval_digest, a.review_digest, a.expires_at,
          a.invalidated_at, a.consumed_at, d.artifact_sha256
        from agreement_workflows w join exact_approvals a on a.approval_id = w.active_approval_id
        join document_versions d on d.workflow_id = w.workflow_id and d.version = w.active_document_version
        where w.workflow_id = ${input.workflowId} and w.tenant_id = ${input.tenantId} for update of w, a
      `;
      const current = rows[0];
      if (!current || current.state !== "approved") throw new Error("Workflow is not exactly approved");
      if (current.invalidated_at || current.consumed_at) throw new Error("Approval is no longer usable");
      if (current.expires_at.getTime() <= input.now.getTime()) throw new Error("Approval has expired");
      if (current.review_digest !== input.expectedReviewDigest) throw new Error("Review digest changed before dispatch");
      const actualSha = createHash("sha256").update(input.artifactBytes).digest("hex");
      if (actualSha !== current.artifact_sha256) throw new Error("Artifact bytes changed before dispatch");
      const dispatchId = randomUUID(); const idempotencyKey = `signlatch:v2:${current.approval_digest}`;
      await tx`update exact_approvals set consumed_at = ${input.now} where approval_id = ${current.active_approval_id} and consumed_at is null`;
      await tx`update agreement_workflows set state = 'dispatching', updated_at = now() where workflow_id = ${input.workflowId}`;
      const expectedRequestDigest=createHash("sha256").update(`${input.workflowId}:${current.review_digest}:${actualSha}`).digest("hex");
      if(operations[0].request_digest!==expectedRequestDigest)throw new Error("Provider reservation does not match exact dispatch request");
      await tx`insert into esign_dispatches (dispatch_id, workflow_id, approval_id, tenant_id, idempotency_key, approval_digest, document_sha256,provider_operation_id,next_attempt_at)
        values (${dispatchId}, ${input.workflowId}, ${current.active_approval_id}, ${input.tenantId}, ${idempotencyKey}, ${current.approval_digest}, ${actualSha},${input.operationId},${input.now})`;
      return { dispatchId, idempotencyKey, documentSha256: actualSha, status: "pending" as const };
    });
  }

  async leaseNext(workerId: string, now: Date, leaseSeconds: number, workflowId?: string) {
    return this.sql.begin(async tx=>{const rows=await tx<Array<{dispatch_id:string;workflow_id:string;tenant_id:string;idempotency_key:string;approval_digest:string;document_sha256:string;attempt_count:number;lease_generation:number;provider_operation_id:string}>>`
      with candidate as (select dispatch_id from esign_dispatches where status='pending' and next_attempt_at<=${now} and (${workflowId??null}::uuid is null or workflow_id=${workflowId??null}::uuid) order by next_attempt_at,created_at for update skip locked limit 1)
      update esign_dispatches d set status='processing',leased_by=${workerId},lease_expires_at=${now}+(${leaseSeconds}*interval '1 second'),attempt_count=d.attempt_count+1,lease_generation=d.lease_generation+1,updated_at=now()
      from candidate where d.dispatch_id=candidate.dispatch_id returning d.dispatch_id,d.workflow_id,d.tenant_id,d.idempotency_key,d.approval_digest,d.document_sha256,d.attempt_count,d.lease_generation,d.provider_operation_id`;
      if(!rows[0])return null;const operation=await tx`update provider_operations set state='running',leased_by=${workerId},lease_generation=lease_generation+1,lease_expires_at=${now}+(${leaseSeconds}*interval '1 second'),updated_at=now() where operation_id=${rows[0].provider_operation_id} and state='reserved'`;if(operation.count!==1)throw new Error("Provider budget lease is unavailable");return {...rows[0],leasedBy:workerId};});
  }
  async markSent(lease:{dispatch_id:string;workflow_id:string;provider_operation_id:string;leasedBy:string;lease_generation:number;approval_digest:string},providerEnvelopeId:string,correlationId?:string){await this.sql.begin(async tx=>{const workflows=await tx`select workflow_id from agreement_workflows where workflow_id=${lease.workflow_id} and state='dispatching' for update`;if(workflows.length!==1)throw new Error("Workflow state changed concurrently");const result=await tx`update esign_dispatches set status='sent',provider_envelope_id=${providerEnvelopeId},provider_correlation_id=${correlationId??null},leased_by=null,lease_expires_at=null,updated_at=now() where dispatch_id=${lease.dispatch_id} and status='processing' and leased_by=${lease.leasedBy} and lease_generation=${lease.lease_generation}`;if(result.count!==1)throw new Error("Dispatch lease lost");const operations=await tx<Array<{tenant_id:string;operation_kind:string;reserved_units:number;created_at:Date}>>`update provider_operations set state='succeeded',result_digest=${lease.approval_digest},result_payload=${tx.json({providerEnvelopeIdHash:createHash("sha256").update(providerEnvelopeId).digest("hex")})},leased_by=null,lease_expires_at=null,updated_at=now() where operation_id=${lease.provider_operation_id} and state='running' and leased_by=${lease.leasedBy} returning tenant_id,operation_kind,reserved_units,created_at`;const operation=operations[0];if(!operation)throw new Error("Provider budget lease lost");const periodStart=new Date(Date.UTC(operation.created_at.getUTCFullYear(),operation.created_at.getUTCMonth(),operation.created_at.getUTCDate()));const budget=await tx`update provider_budgets set reserved=reserved-${operation.reserved_units},consumed=consumed+${operation.reserved_units},version=version+1 where tenant_id=${operation.tenant_id} and provider='foxit' and operation_kind=${operation.operation_kind} and period_start=${periodStart}`;if(budget.count!==1)throw new Error("Provider budget row missing");await tx`update agreement_workflows set state='sent',updated_at=now() where workflow_id=${lease.workflow_id} and state='dispatching'`;});}
  async markReconcile(lease:{dispatch_id:string;workflow_id:string;provider_operation_id:string;leasedBy:string;lease_generation:number},correlationId?:string,diagnostic?:ProviderDiagnostic,now:Date=new Date()){await this.sql.begin(async tx=>{const safeDiagnostic=sanitizeProviderDiagnostic(diagnostic);const result=await tx`update esign_dispatches set status='reconcile',next_reconciliation_at=${now},provider_correlation_id=${correlationId??null},leased_by=null,lease_expires_at=null,updated_at=now() where dispatch_id=${lease.dispatch_id} and status='processing' and leased_by=${lease.leasedBy} and lease_generation=${lease.lease_generation}`;if(result.count!==1)throw new Error("Dispatch lease lost");const operation=await tx`update provider_operations set state='reconcile',provider_correlation=${correlationId??null},result_payload=${safeDiagnostic?tx.json({diagnostic:safeDiagnostic} as JSONValue):null},leased_by=null,lease_expires_at=null,updated_at=now() where operation_id=${lease.provider_operation_id} and state='running' and leased_by=${lease.leasedBy}`;if(operation.count!==1)throw new Error("Provider operation lease lost");const workflow=await tx`update agreement_workflows set state='reconcile',updated_at=now() where workflow_id=${lease.workflow_id} and state='dispatching'`;if(workflow.count!==1)throw new Error("Workflow state changed concurrently");});}
  async releaseSafeRetry(lease:{dispatch_id:string;provider_operation_id:string;leasedBy:string;lease_generation:number;attempt_count:number},errorCode:string,now:Date,retryAfterMs?:number,diagnostic?:ProviderDiagnostic){await this.sql.begin(async tx=>{const delayMs=boundedRetryDelay(retryAfterMs,lease.attempt_count);const nextAttemptAt=new Date(now.getTime()+delayMs);const safeDiagnostic=sanitizeProviderDiagnostic(diagnostic);const result=await tx`update esign_dispatches set status='pending',next_attempt_at=${nextAttemptAt},leased_by=null,lease_expires_at=null,updated_at=now() where dispatch_id=${lease.dispatch_id} and status='processing' and leased_by=${lease.leasedBy} and lease_generation=${lease.lease_generation}`;if(result.count!==1)throw new Error("Dispatch lease lost");const operation=await tx`update provider_operations set state='reserved',result_payload=${tx.json({errorCode,retryDelayMs:delayMs,...(safeDiagnostic?{diagnostic:safeDiagnostic}:{})} as JSONValue)},leased_by=null,lease_expires_at=null,updated_at=now() where operation_id=${lease.provider_operation_id} and state='running' and leased_by=${lease.leasedBy}`;if(operation.count!==1)throw new Error("Provider budget lease lost");});}
  async markDenied(lease:{dispatch_id:string;workflow_id:string;provider_operation_id:string;leasedBy:string;lease_generation:number},errorCode:string){await this.sql.begin(async tx=>{const workflows=await tx`select workflow_id from agreement_workflows where workflow_id=${lease.workflow_id} and state='dispatching' for update`;if(workflows.length!==1)throw new Error("Workflow state changed concurrently");const result=await tx`update esign_dispatches set status='denied',leased_by=null,lease_expires_at=null,updated_at=now() where dispatch_id=${lease.dispatch_id} and status='processing' and leased_by=${lease.leasedBy} and lease_generation=${lease.lease_generation}`;if(result.count!==1)throw new Error("Dispatch lease lost");const operations=await tx<Array<{tenant_id:string;operation_kind:string;reserved_units:number;created_at:Date}>>`update provider_operations set state='failed',result_payload=${tx.json({errorCode})},leased_by=null,lease_expires_at=null,updated_at=now() where operation_id=${lease.provider_operation_id} and state='running' and leased_by=${lease.leasedBy} returning tenant_id,operation_kind,reserved_units,created_at`;const operation=operations[0];if(!operation)throw new Error("Provider budget lease lost");const periodStart=new Date(Date.UTC(operation.created_at.getUTCFullYear(),operation.created_at.getUTCMonth(),operation.created_at.getUTCDate()));const budget=await tx`update provider_budgets set reserved=reserved-${operation.reserved_units},version=version+1 where tenant_id=${operation.tenant_id} and provider='foxit' and operation_kind=${operation.operation_kind} and period_start=${periodStart}`;if(budget.count!==1)throw new Error("Provider budget row missing");await tx`update agreement_workflows set state='failed',updated_at=now() where workflow_id=${lease.workflow_id} and state='dispatching'`;});}
  async resolveReconciliation(dispatchId:string,providerEnvelopeId:string,fence?:{leasedBy:string;reconciliation_lease_generation:number;tenant_id:string;now:Date}){if(!/^[A-Za-z0-9._:-]{1,128}$/.test(providerEnvelopeId))throw new Error("Provider envelope id is invalid");await this.sql.begin(async tx=>{const workflows=await tx`select w.workflow_id from agreement_workflows w join esign_dispatches d on d.workflow_id=w.workflow_id where d.dispatch_id=${dispatchId} and w.state='reconcile' for update of w`;if(workflows.length!==1)throw new Error("Workflow state changed concurrently");const dispatches=await tx<Array<{workflow_id:string;provider_operation_id:string;approval_digest:string}>>`update esign_dispatches set status='sent',reconciliation_leased_by=null,reconciliation_lease_expires_at=null,provider_envelope_id=${providerEnvelopeId},updated_at=now() where dispatch_id=${dispatchId} and status='reconcile' and (${fence?.leasedBy??null}::text is null or (tenant_id=${fence?.tenant_id??null}::uuid and reconciliation_leased_by=${fence?.leasedBy??null} and reconciliation_lease_generation=${fence?.reconciliation_lease_generation??-1} and reconciliation_lease_expires_at>${fence?.now??new Date(0)})) returning workflow_id,provider_operation_id,approval_digest`;const dispatch=dispatches[0];if(!dispatch)throw new Error("Reconciliation changed concurrently");const operations=await tx<Array<{tenant_id:string;operation_kind:string;reserved_units:number;created_at:Date}>>`update provider_operations set state='succeeded',result_digest=${dispatch.approval_digest},result_payload=${tx.json({providerEnvelopeIdHash:createHash("sha256").update(providerEnvelopeId).digest("hex")})},updated_at=now() where operation_id=${dispatch.provider_operation_id} and state='reconcile' returning tenant_id,operation_kind,reserved_units,created_at`;const operation=operations[0];if(!operation)throw new Error("Provider reconciliation budget changed concurrently");const periodStart=new Date(Date.UTC(operation.created_at.getUTCFullYear(),operation.created_at.getUTCMonth(),operation.created_at.getUTCDate()));const budget=await tx`update provider_budgets set reserved=reserved-${operation.reserved_units},consumed=consumed+${operation.reserved_units},version=version+1 where tenant_id=${operation.tenant_id} and provider='foxit' and operation_kind=${operation.operation_kind} and period_start=${periodStart}`;if(budget.count!==1)throw new Error("Provider budget row missing");await tx`update agreement_workflows set state='sent',updated_at=now() where workflow_id=${dispatch.workflow_id} and state='reconcile'`;});}

  async resolveReconciliationAbsent(workflowId: string, evidenceSha256: string, authorizationId: string) {
    if (!/^[0-9a-f-]{36}$/.test(workflowId)) throw new Error("Workflow id is invalid");
    if (!/^[0-9a-f]{64}$/.test(evidenceSha256)) throw new Error("Evidence SHA-256 is invalid");
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(authorizationId)) throw new Error("Authorization id is invalid");
    const authorizationIdHash = createHash("sha256").update(authorizationId).digest("hex");
    return this.sql.begin(async (tx) => {
      const workflows = await tx<Array<{ workflow_id: string; state: string }>>`
        select workflow_id,state from agreement_workflows
        where workflow_id=${workflowId} and state in ('reconcile','dispatching') for update
      `;
      if (workflows.length !== 1) throw new Error("Workflow is not awaiting reconciliation");
      const dispatches = await tx<Array<{ provider_operation_id: string }>>`
        update esign_dispatches set status='denied',reconciliation_leased_by=null,
          reconciliation_lease_expires_at=null,updated_at=now()
        where workflow_id=${workflowId} and status='reconcile'
        returning provider_operation_id
      `;
      if (dispatches.length !== 1) throw new Error("Exactly one unresolved dispatch is required");
      const operations = await tx<Array<{ tenant_id: string; operation_kind: string; reserved_units: number; created_at: Date }>>`
        update provider_operations set state='failed',result_payload=${tx.json({
          errorCode: "provider-envelope-confirmed-absent", evidenceSha256, authorizationIdHash,
        })},leased_by=null,lease_expires_at=null,updated_at=now()
        where operation_id=${dispatches[0].provider_operation_id} and state='reconcile'
        returning tenant_id,operation_kind,reserved_units,created_at
      `;
      const operation = operations[0];
      if (!operation) throw new Error("Provider operation is not awaiting reconciliation");
      const periodStart = new Date(Date.UTC(operation.created_at.getUTCFullYear(), operation.created_at.getUTCMonth(), operation.created_at.getUTCDate()));
      const budget = await tx`
        update provider_budgets set reserved=reserved-${operation.reserved_units},version=version+1
        where tenant_id=${operation.tenant_id} and provider='foxit'
          and operation_kind=${operation.operation_kind} and period_start=${periodStart}
          and reserved>=${operation.reserved_units}
      `;
      if (budget.count !== 1) throw new Error("Provider budget row missing or already released");
      const workflow = await tx`update agreement_workflows set state='failed',updated_at=now() where workflow_id=${workflowId} and state in ('reconcile','dispatching')`;
      if (workflow.count !== 1) throw new Error("Workflow state changed concurrently");
      return { status: "failed" as const, evidenceSha256, authorizationIdHash };
    });
  }

  async leaseNextReconciliation(workerId: string, now: Date, leaseSeconds: number) {
    const rows = await this.sql<Array<{ dispatch_id: string; workflow_id: string; tenant_id: string; idempotency_key: string; reconciliation_attempt_count: number; reconciliation_lease_generation: number }>>`
      with candidate as (
        select dispatch_id from esign_dispatches
        where status='reconcile' and next_reconciliation_at<=${now}
          and (reconciliation_lease_expires_at is null or reconciliation_lease_expires_at<=${now})
        order by next_reconciliation_at,created_at for update skip locked limit 1
      )
      update esign_dispatches d set
        reconciliation_leased_by=${workerId},
        reconciliation_lease_expires_at=${now}+(${leaseSeconds}*interval '1 second'),
        reconciliation_attempt_count=d.reconciliation_attempt_count+1,
        reconciliation_lease_generation=d.reconciliation_lease_generation+1,
        updated_at=now()
      from candidate where d.dispatch_id=candidate.dispatch_id
      returning d.dispatch_id,d.workflow_id,d.tenant_id,d.idempotency_key,d.reconciliation_attempt_count,d.reconciliation_lease_generation
    `;
    return rows[0] ? { ...rows[0], leasedBy: workerId } : null;
  }

  async releaseUnresolvedReconciliation(lease: { dispatch_id: string; leasedBy: string; reconciliation_lease_generation: number }, now: Date, delayMs: number, reasonCode: string) {
    const safeReason = /^[a-z0-9-]{1,64}$/.test(reasonCode) ? reasonCode : "lookup-unresolved";
    const boundedDelay = Math.max(60_000, Math.min(24 * 60 * 60_000, Math.floor(delayMs)));
    const result = await this.sql`
      update esign_dispatches set
        next_reconciliation_at=${new Date(now.getTime() + boundedDelay)},
        reconciliation_leased_by=null,reconciliation_lease_expires_at=null,updated_at=now()
      where dispatch_id=${lease.dispatch_id} and status='reconcile'
        and reconciliation_leased_by=${lease.leasedBy}
        and reconciliation_lease_generation=${lease.reconciliation_lease_generation}
    `;
    if (result.count !== 1) throw new Error("Reconciliation lease lost");
    return { reasonCode: safeReason, retryDelayMs: boundedDelay };
  }

  async reconciliationStatus(workflowId: string, tenantId: string) {
    const rows = await this.sql<Array<{ status: string; attempt_count: number; next_reconciliation_at: Date; lookup_supported: boolean }>>`
      select d.status,d.reconciliation_attempt_count as attempt_count,d.next_reconciliation_at,
        ${Boolean(process.env.FOXIT_ESIGN_CORRELATION_PATH?.includes("{idempotencyKey}") && process.env.SIGNLATCH_FOXIT_CORRELATION_LOOKUP_CONFIRMED === "true")}::boolean as lookup_supported
      from esign_dispatches d where d.workflow_id=${workflowId} and d.tenant_id=${tenantId}
      order by d.created_at desc limit 1
    `;
    return rows[0] ?? null;
  }

  async recoverExpiredLeases(now: Date): Promise<number> {
    return this.sql.begin(async (tx) => {
      const rows = await tx<Array<{ provider_operation_id: string; workflow_id: string }>>`
        update esign_dispatches
        set status = 'reconcile', leased_by = null, lease_expires_at = null, updated_at = now()
        where status = 'processing' and lease_expires_at <= ${now}
        returning provider_operation_id, workflow_id
      `;
      if (rows.length === 0) return 0;
      const operationIds = rows.map((row) => row.provider_operation_id);
      const workflowIds = rows.map((row) => row.workflow_id);
      await tx`
        update provider_operations
        set state = 'reconcile', leased_by = null, lease_expires_at = null, updated_at = now()
        where operation_id = any(${operationIds}) and state = 'running'
      `;
      await tx`update agreement_workflows set state='reconcile',updated_at=now() where workflow_id=any(${workflowIds}) and state='dispatching'`;
      return rows.length;
    });
  }
}

function boundedRetryDelay(retryAfterMs: number | undefined, attemptCount: number): number {
  const fallback = Math.min(60_000, 1_000 * 2 ** Math.max(0, attemptCount - 1));
  const requested = Number.isFinite(retryAfterMs) ? Number(retryAfterMs) : fallback;
  return Math.max(1_000, Math.min(7 * 24 * 60 * 60_000, Math.floor(requested)));
}
