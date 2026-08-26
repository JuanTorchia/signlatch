import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "postgres";

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
      await tx`insert into esign_dispatches (dispatch_id, workflow_id, approval_id, tenant_id, idempotency_key, approval_digest, document_sha256,provider_operation_id)
        values (${dispatchId}, ${input.workflowId}, ${current.active_approval_id}, ${input.tenantId}, ${idempotencyKey}, ${current.approval_digest}, ${actualSha},${input.operationId})`;
      return { dispatchId, idempotencyKey, documentSha256: actualSha, status: "pending" as const };
    });
  }

  async leaseNext(workerId: string, now: Date, leaseSeconds: number, workflowId?: string) {
    return this.sql.begin(async tx=>{const rows=await tx<Array<{dispatch_id:string;workflow_id:string;tenant_id:string;idempotency_key:string;approval_digest:string;document_sha256:string;attempt_count:number;lease_generation:number;provider_operation_id:string}>>`
      with candidate as (select dispatch_id from esign_dispatches where status='pending' and (${workflowId??null}::uuid is null or workflow_id=${workflowId??null}::uuid) order by created_at for update skip locked limit 1)
      update esign_dispatches d set status='processing',leased_by=${workerId},lease_expires_at=${now}+(${leaseSeconds}*interval '1 second'),attempt_count=d.attempt_count+1,lease_generation=d.lease_generation+1,updated_at=now()
      from candidate where d.dispatch_id=candidate.dispatch_id returning d.dispatch_id,d.workflow_id,d.tenant_id,d.idempotency_key,d.approval_digest,d.document_sha256,d.attempt_count,d.lease_generation,d.provider_operation_id`;
      if(!rows[0])return null;const operation=await tx`update provider_operations set state='running',leased_by=${workerId},lease_generation=lease_generation+1,lease_expires_at=${now}+(${leaseSeconds}*interval '1 second'),updated_at=now() where operation_id=${rows[0].provider_operation_id} and state='reserved'`;if(operation.count!==1)throw new Error("Provider budget lease is unavailable");return {...rows[0],leasedBy:workerId};});
  }
  async markSent(lease:{dispatch_id:string;provider_operation_id:string;leasedBy:string;lease_generation:number;approval_digest:string},providerEnvelopeId:string,correlationId?:string){await this.sql.begin(async tx=>{const result=await tx`update esign_dispatches set status='sent',provider_envelope_id=${providerEnvelopeId},provider_correlation_id=${correlationId??null},leased_by=null,lease_expires_at=null,updated_at=now() where dispatch_id=${lease.dispatch_id} and status='processing' and leased_by=${lease.leasedBy} and lease_generation=${lease.lease_generation}`;if(result.count!==1)throw new Error("Dispatch lease lost");const operations=await tx<Array<{tenant_id:string;operation_kind:string;reserved_units:number;created_at:Date}>>`update provider_operations set state='succeeded',result_digest=${lease.approval_digest},result_payload=${tx.json({providerEnvelopeIdHash:createHash("sha256").update(providerEnvelopeId).digest("hex")})},leased_by=null,lease_expires_at=null,updated_at=now() where operation_id=${lease.provider_operation_id} and state='running' and leased_by=${lease.leasedBy} returning tenant_id,operation_kind,reserved_units,created_at`;const operation=operations[0];if(!operation)throw new Error("Provider budget lease lost");const periodStart=new Date(Date.UTC(operation.created_at.getUTCFullYear(),operation.created_at.getUTCMonth(),operation.created_at.getUTCDate()));await tx`update provider_budgets set reserved=reserved-${operation.reserved_units},consumed=consumed+${operation.reserved_units},version=version+1 where tenant_id=${operation.tenant_id} and provider='foxit' and operation_kind=${operation.operation_kind} and period_start=${periodStart}`;});}
  async markReconcile(lease:{dispatch_id:string;provider_operation_id:string;leasedBy:string;lease_generation:number},correlationId?:string){await this.sql.begin(async tx=>{const result=await tx`update esign_dispatches set status='reconcile',provider_correlation_id=${correlationId??null},leased_by=null,lease_expires_at=null,updated_at=now() where dispatch_id=${lease.dispatch_id} and status='processing' and leased_by=${lease.leasedBy} and lease_generation=${lease.lease_generation}`;if(result.count!==1)throw new Error("Dispatch lease lost");await tx`update provider_operations set state='reconcile',provider_correlation=${correlationId??null},leased_by=null,lease_expires_at=null,updated_at=now() where operation_id=${lease.provider_operation_id} and state='running' and leased_by=${lease.leasedBy}`;});}
  async resolveReconciliation(dispatchId:string,providerEnvelopeId:string){await this.sql.begin(async tx=>{const dispatches=await tx<Array<{provider_operation_id:string;approval_digest:string}>>`update esign_dispatches set status='sent',provider_envelope_id=${providerEnvelopeId},updated_at=now() where dispatch_id=${dispatchId} and status='reconcile' returning provider_operation_id,approval_digest`;const dispatch=dispatches[0];if(!dispatch)throw new Error("Reconciliation changed concurrently");const operations=await tx<Array<{tenant_id:string;operation_kind:string;reserved_units:number;created_at:Date}>>`update provider_operations set state='succeeded',result_digest=${dispatch.approval_digest},result_payload=${tx.json({providerEnvelopeIdHash:createHash("sha256").update(providerEnvelopeId).digest("hex")})},updated_at=now() where operation_id=${dispatch.provider_operation_id} and state='reconcile' returning tenant_id,operation_kind,reserved_units,created_at`;const operation=operations[0];if(!operation)throw new Error("Provider reconciliation budget changed concurrently");const periodStart=new Date(Date.UTC(operation.created_at.getUTCFullYear(),operation.created_at.getUTCMonth(),operation.created_at.getUTCDate()));await tx`update provider_budgets set reserved=reserved-${operation.reserved_units},consumed=consumed+${operation.reserved_units},version=version+1 where tenant_id=${operation.tenant_id} and provider='foxit' and operation_kind=${operation.operation_kind} and period_start=${periodStart}`;});}

  async recoverExpiredLeases(now: Date): Promise<number> {
    return this.sql.begin(async (tx) => {
      const rows = await tx<Array<{ provider_operation_id: string }>>`
        update esign_dispatches
        set status = 'reconcile', leased_by = null, lease_expires_at = null, updated_at = now()
        where status = 'processing' and lease_expires_at <= ${now}
        returning provider_operation_id
      `;
      if (rows.length === 0) return 0;
      const operationIds = rows.map((row) => row.provider_operation_id);
      await tx`
        update provider_operations
        set state = 'reconcile', leased_by = null, lease_expires_at = null, updated_at = now()
        where operation_id = any(${operationIds}) and state = 'running'
      `;
      return rows.length;
    });
  }
}
