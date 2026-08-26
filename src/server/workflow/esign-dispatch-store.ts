import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "postgres";

export class ESignDispatchStore {
  constructor(private readonly sql: Sql) {}

  async enqueue(input: { workflowId: string; tenantId: string; expectedReviewDigest: string; artifactBytes: Uint8Array; now: Date }) {
    return this.sql.begin(async (tx) => {
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
      await tx`insert into esign_dispatches (dispatch_id, workflow_id, approval_id, tenant_id, idempotency_key, approval_digest, document_sha256)
        values (${dispatchId}, ${input.workflowId}, ${current.active_approval_id}, ${input.tenantId}, ${idempotencyKey}, ${current.approval_digest}, ${actualSha})`;
      return { dispatchId, idempotencyKey, documentSha256: actualSha, status: "pending" as const };
    });
  }

  async leaseNext(workerId: string, now: Date, leaseSeconds: number, workflowId?: string) {
    return this.sql.begin(async tx=>{const rows=await tx<Array<{dispatch_id:string;workflow_id:string;tenant_id:string;idempotency_key:string;approval_digest:string;document_sha256:string;attempt_count:number;lease_generation:number}>>`
      with candidate as (select dispatch_id from esign_dispatches where status='pending' and (${workflowId??null}::uuid is null or workflow_id=${workflowId??null}::uuid) order by created_at for update skip locked limit 1)
      update esign_dispatches d set status='processing',leased_by=${workerId},lease_expires_at=${now}+(${leaseSeconds}*interval '1 second'),attempt_count=d.attempt_count+1,lease_generation=d.lease_generation+1,updated_at=now()
      from candidate where d.dispatch_id=candidate.dispatch_id returning d.dispatch_id,d.workflow_id,d.tenant_id,d.idempotency_key,d.approval_digest,d.document_sha256,d.attempt_count,d.lease_generation`;
      return rows[0] ? {...rows[0],leasedBy:workerId} : null;});
  }
  async markSent(lease:{dispatch_id:string;leasedBy:string;lease_generation:number},providerEnvelopeId:string,correlationId?:string){const result=await this.sql`update esign_dispatches set status='sent',provider_envelope_id=${providerEnvelopeId},provider_correlation_id=${correlationId??null},leased_by=null,lease_expires_at=null,updated_at=now() where dispatch_id=${lease.dispatch_id} and status='processing' and leased_by=${lease.leasedBy} and lease_generation=${lease.lease_generation}`;if(result.count!==1)throw new Error("Dispatch lease lost");}
  async markReconcile(lease:{dispatch_id:string;leasedBy:string;lease_generation:number},correlationId?:string){const result=await this.sql`update esign_dispatches set status='reconcile',provider_correlation_id=${correlationId??null},leased_by=null,lease_expires_at=null,updated_at=now() where dispatch_id=${lease.dispatch_id} and status='processing' and leased_by=${lease.leasedBy} and lease_generation=${lease.lease_generation}`;if(result.count!==1)throw new Error("Dispatch lease lost");}
  async resolveReconciliation(dispatchId:string,providerEnvelopeId:string){const result=await this.sql`update esign_dispatches set status='sent',provider_envelope_id=${providerEnvelopeId},updated_at=now() where dispatch_id=${dispatchId} and status='reconcile'`;if(result.count!==1)throw new Error("Reconciliation changed concurrently");}
}
