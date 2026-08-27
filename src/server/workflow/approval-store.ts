import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";

import { exactApprovalDigest, type ExactApprovalV2 } from "@/core/approval/envelope-v2";

export class ApprovalStore {
  constructor(private readonly sql: Sql) {}

  async approveExact(input: ExactApprovalV2, now = new Date()): Promise<{ approvalId: string; digest: string; generation: number }> {
    const digest = exactApprovalDigest(input);
    if (Date.parse(input.expiresAt) <= now.getTime()) throw new Error("Approval has expired");
    return this.sql.begin(async (tx) => {
      const rows = await tx<Array<{ state: string; active_review_version: number; snapshot_digest: string; approval_generation: number }>>`
        select w.state, w.active_review_version, r.snapshot_digest, w.approval_generation
        from agreement_workflows w join review_snapshots r
          on r.workflow_id = w.workflow_id and r.version = w.active_review_version
        where w.workflow_id = ${input.workflowId} and w.tenant_id = ${input.tenantId}
        for update of w
      `;
      const current = rows[0];
      if (!current) throw new Error("Workflow not found");
      if (current.state === "approved") {
        const expired = await tx`
          update exact_approvals set invalidated_at = coalesce(invalidated_at, ${now})
          where workflow_id = ${input.workflowId} and invalidated_at is null and consumed_at is null
            and expires_at <= ${now}
        `;
        if (expired.count !== 1) throw new Error("Workflow already has a fresh approval");
      } else if (current.state !== "review") {
        throw new Error("Workflow is not awaiting approval");
      }
      if (current.active_review_version !== input.reviewVersion || current.snapshot_digest !== input.reviewDigest) {
        throw new Error("Review snapshot is stale");
      }
      const approvalId = randomUUID();
      const generation = current.approval_generation + 1;
      await tx`
        insert into exact_approvals (approval_id, workflow_id, review_version, review_digest,
          approval_digest, approver_principal_id, nonce, generation, issued_at, expires_at)
        values (${approvalId}, ${input.workflowId}, ${input.reviewVersion}, ${input.reviewDigest},
          ${digest}, ${input.approverId}, ${input.nonce}, ${generation}, ${input.issuedAt}, ${input.expiresAt})
      `;
      await tx`
        update agreement_workflows set state = 'approved', active_approval_id = ${approvalId},
          approval_generation = ${generation}, updated_at = now() where workflow_id = ${input.workflowId}
      `;
      return { approvalId, digest, generation };
    });
  }

  async invalidateForNewReview(workflowId: string, tenantId: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      const result = await tx`
        update agreement_workflows set state = 'review', active_approval_id = null, updated_at = now()
        where workflow_id = ${workflowId} and tenant_id = ${tenantId} and state in ('review','approved')
      `;
      if (result.count !== 1) throw new Error("Workflow cannot be mutated");
      await tx`
        update exact_approvals set invalidated_at = coalesce(invalidated_at, now())
        where workflow_id = ${workflowId} and consumed_at is null
      `;
    });
  }
}
