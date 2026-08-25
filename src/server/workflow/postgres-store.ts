import { randomUUID } from "node:crypto";
import type { JSONValue, Sql, TransactionSql } from "postgres";

import {
  approvalDigest,
  documentDigest,
  isApprovalFresh,
  type ApprovalEnvelopeV1,
} from "../../core/approval/envelope";
import { AUDIT_GENESIS, auditEventHash, type AuditEventInput } from "../../core/workflow/audit";
import { assertWorkflowTransition, type WorkflowState } from "../../core/workflow/state-machine";

type WorkflowRow = {
  workflow_id: string;
  tenant_id: string;
  state: WorkflowState;
  version: number;
  approval_id: string | null;
  approval_digest: string | null;
  approval_envelope: ApprovalEnvelopeV1 | null;
};

type AuditHashRow = { event_hash: string };

export class PostgresWorkflowStore {
  constructor(private readonly sql: Sql) {}

  async createReview(envelope: ApprovalEnvelopeV1): Promise<void> {
    await this.sql.begin(async (tx) => {
      await tx`
        insert into workflows (workflow_id, tenant_id, state, version)
        values (${envelope.workflowId}, ${envelope.tenantId}, 'review', 1)
      `;
      await this.appendAudit(tx, envelope.workflowId, envelope.tenantId, "workflow.review_ready", "system", {
        documentSha256: envelope.documentSha256,
      });
    });
  }

  async approve(envelope: ApprovalEnvelopeV1, expectedVersion: number): Promise<number> {
    const digest = approvalDigest(envelope);
    return this.sql.begin(async (tx) => {
      const rows = await tx<WorkflowRow[]>`
        select workflow_id, tenant_id, state, version, approval_id, approval_digest, approval_envelope
        from workflows
        where workflow_id = ${envelope.workflowId} and tenant_id = ${envelope.tenantId}
        for update
      `;
      const workflow = rows[0];
      if (!workflow) throw new Error("Workflow does not exist");
      if (workflow.version !== expectedVersion) throw new Error("Workflow version conflict");
      assertWorkflowTransition(workflow.state, "approved");

      const nextVersion = workflow.version + 1;
      await tx`
        update workflows
        set state = 'approved', version = ${nextVersion}, approval_id = ${envelope.approvalId},
            approval_digest = ${digest}, approval_envelope = ${tx.json(envelope)}, updated_at = now()
        where workflow_id = ${envelope.workflowId}
      `;
      await this.appendAudit(tx, envelope.workflowId, envelope.tenantId, "approval.granted", envelope.approverId, {
        approvalDigest: digest,
        approvalId: envelope.approvalId,
      });
      return nextVersion;
    });
  }

  async claimDispatch(
    envelope: ApprovalEnvelopeV1,
    documentBytes: Uint8Array,
    now: Date,
    expectedVersion: number,
  ): Promise<{ idempotencyKey: string; outboxId: string; version: number }> {
    return this.sql.begin(async (tx) => {
      const rows = await tx<WorkflowRow[]>`
        select workflow_id, tenant_id, state, version, approval_id, approval_digest, approval_envelope
        from workflows
        where workflow_id = ${envelope.workflowId} and tenant_id = ${envelope.tenantId}
        for update
      `;
      const workflow = rows[0];
      if (!workflow) throw new Error("Workflow does not exist");
      if (workflow.version !== expectedVersion) throw new Error("Workflow version conflict");
      assertWorkflowTransition(workflow.state, "dispatching");
      if (!workflow.approval_digest || workflow.approval_digest !== approvalDigest(envelope)) {
        throw new Error("Approval envelope changed after human approval");
      }
      if (!isApprovalFresh(envelope, now)) throw new Error("Approval has expired");
      if (documentDigest(documentBytes) !== envelope.documentSha256) {
        throw new Error("Document bytes do not match the approved artifact");
      }

      const nextVersion = workflow.version + 1;
      const idempotencyKey = `signlatch:${envelope.approvalId}`;
      const outboxId = randomUUID();
      await tx`
        update workflows
        set state = 'dispatching', version = ${nextVersion}, updated_at = now()
        where workflow_id = ${envelope.workflowId}
      `;
      await tx`
        insert into dispatch_outbox (
          outbox_id, workflow_id, tenant_id, approval_id, idempotency_key, payload
        ) values (
          ${outboxId}, ${envelope.workflowId}, ${envelope.tenantId}, ${envelope.approvalId},
          ${idempotencyKey}, ${tx.json({ approvalDigest: workflow.approval_digest })}
        )
      `;
      await this.appendAudit(tx, envelope.workflowId, envelope.tenantId, "dispatch.claimed", "dispatcher", {
        approvalId: envelope.approvalId,
        idempotencyKey,
        outboxId,
      });
      return { idempotencyKey, outboxId, version: nextVersion };
    });
  }

  async markAmbiguous(workflowId: string, tenantId: string, expectedVersion: number): Promise<number> {
    return this.transition(workflowId, tenantId, "dispatching", "reconcile", expectedVersion, "dispatch.ambiguous");
  }

  async markSent(
    workflowId: string,
    tenantId: string,
    from: "dispatching" | "reconcile",
    expectedVersion: number,
    providerEnvelopeId: string,
  ): Promise<number> {
    return this.sql.begin(async (tx) => {
      const workflow = await this.lockExpected(tx, workflowId, tenantId, from, expectedVersion);
      assertWorkflowTransition(workflow.state, "sent");
      const nextVersion = workflow.version + 1;
      await tx`
        update workflows set state = 'sent', version = ${nextVersion},
          provider_envelope_id = ${providerEnvelopeId}, updated_at = now()
        where workflow_id = ${workflowId}
      `;
      await tx`
        update dispatch_outbox set status = 'sent', processed_at = now()
        where workflow_id = ${workflowId} and status = 'pending'
      `;
      await this.appendAudit(tx, workflowId, tenantId, "dispatch.sent", "dispatcher", { providerEnvelopeId });
      return nextVersion;
    });
  }

  private async transition(
    workflowId: string,
    tenantId: string,
    from: WorkflowState,
    to: WorkflowState,
    expectedVersion: number,
    eventType: string,
  ): Promise<number> {
    return this.sql.begin(async (tx) => {
      const workflow = await this.lockExpected(tx, workflowId, tenantId, from, expectedVersion);
      assertWorkflowTransition(workflow.state, to);
      const nextVersion = workflow.version + 1;
      await tx`
        update workflows set state = ${to}, version = ${nextVersion}, updated_at = now()
        where workflow_id = ${workflowId}
      `;
      await this.appendAudit(tx, workflowId, tenantId, eventType, "dispatcher", {});
      return nextVersion;
    });
  }

  private async lockExpected(
    tx: TransactionSql,
    workflowId: string,
    tenantId: string,
    state: WorkflowState,
    expectedVersion: number,
  ): Promise<WorkflowRow> {
    const rows = await tx<WorkflowRow[]>`
      select workflow_id, tenant_id, state, version, approval_id, approval_digest, approval_envelope
      from workflows where workflow_id = ${workflowId} and tenant_id = ${tenantId} for update
    `;
    const workflow = rows[0];
    if (!workflow) throw new Error("Workflow does not exist");
    if (workflow.state !== state || workflow.version !== expectedVersion) {
      throw new Error("Workflow state or version conflict");
    }
    return workflow;
  }

  private async appendAudit(
    tx: TransactionSql,
    workflowId: string,
    tenantId: string,
    type: string,
    actorId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const previousRows = await tx<AuditHashRow[]>`
      select event_hash from audit_events where workflow_id = ${workflowId}
      order by sequence desc limit 1
    `;
    const previousHash = previousRows[0]?.event_hash ?? AUDIT_GENESIS;
    const event: AuditEventInput = {
      eventId: randomUUID(),
      workflowId,
      tenantId,
      type,
      actorId,
      occurredAt: new Date().toISOString(),
      data,
    };
    const eventHash = auditEventHash(previousHash, event);
    await tx`
      insert into audit_events (
        event_id, workflow_id, tenant_id, event_type, actor_id, occurred_at,
        event_data, previous_hash, event_hash
      ) values (
        ${event.eventId}, ${workflowId}, ${tenantId}, ${type}, ${actorId},
        ${event.occurredAt}, ${tx.json(data as JSONValue)}, ${previousHash}, ${eventHash}
      )
    `;
  }
}
