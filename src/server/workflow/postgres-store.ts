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

export type LeasedDispatch = {
  outboxId: string;
  workflowId: string;
  tenantId: string;
  approvalId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  workflowVersion: number;
  leasedBy: string;
};

type LeasedDispatchRow = {
  outbox_id: string;
  workflow_id: string;
  tenant_id: string;
  approval_id: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  attempt_count: number;
  workflow_version: number;
  leased_by: string;
};

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
    return this.sql.begin(async (tx) => {
      const workflow = await this.lockExpected(tx, workflowId, tenantId, "dispatching", expectedVersion);
      assertWorkflowTransition(workflow.state, "reconcile");
      const nextVersion = workflow.version + 1;
      await tx`
        update workflows set state = 'reconcile', version = ${nextVersion}, updated_at = now()
        where workflow_id = ${workflowId}
      `;
      await tx`
        update dispatch_outbox
        set status = 'reconcile', leased_by = null, lease_expires_at = null
        where workflow_id = ${workflowId} and status = 'processing'
      `;
      await this.appendAudit(tx, workflowId, tenantId, "dispatch.ambiguous", "dispatcher", {});
      return nextVersion;
    });
  }

  async leaseNextDispatch(
    workerId: string,
    now: Date,
    leaseSeconds: number,
    maxAttempts: number,
  ): Promise<LeasedDispatch | null> {
    if (!workerId) throw new Error("Worker ID is required");
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1) throw new Error("Lease duration is invalid");
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error("Retry budget is invalid");

    return this.sql.begin(async (tx) => {
      const rows = await tx<LeasedDispatchRow[]>`
        with candidate as (
          select outbox_id
          from dispatch_outbox
          where status = 'pending' and available_at <= ${now} and attempt_count < ${maxAttempts}
          order by created_at
          for update skip locked
          limit 1
        )
        update dispatch_outbox as outbox
        set status = 'processing', leased_by = ${workerId},
            lease_expires_at = ${now} + (${leaseSeconds} * interval '1 second'),
            attempt_count = outbox.attempt_count + 1
        from candidate, workflows
        where outbox.outbox_id = candidate.outbox_id
          and workflows.workflow_id = outbox.workflow_id
          and workflows.state = 'dispatching'
        returning outbox.outbox_id, outbox.workflow_id, outbox.tenant_id,
          outbox.approval_id, outbox.idempotency_key, outbox.payload,
          outbox.attempt_count, workflows.version as workflow_version,
          outbox.leased_by
      `;
      const row = rows[0];
      if (!row) return null;
      return {
        outboxId: row.outbox_id,
        workflowId: row.workflow_id,
        tenantId: row.tenant_id,
        approvalId: row.approval_id,
        idempotencyKey: row.idempotency_key,
        payload: row.payload,
        attemptCount: row.attempt_count,
        workflowVersion: row.workflow_version,
        leasedBy: row.leased_by,
      };
    });
  }

  async releaseSafeFailure(
    lease: LeasedDispatch,
    retryAt: Date,
    errorCode: string,
  ): Promise<void> {
    await this.sql.begin(async (tx) => {
      const workflow = await this.lockExpected(
        tx,
        lease.workflowId,
        lease.tenantId,
        "dispatching",
        lease.workflowVersion,
      );
      const result = await tx`
        update dispatch_outbox
        set status = 'pending', available_at = ${retryAt}, leased_by = null,
            lease_expires_at = null, last_error = ${errorCode}
        where outbox_id = ${lease.outboxId} and status = 'processing'
          and leased_by = ${lease.leasedBy}
      `;
      if (result.count !== 1) throw new Error("Dispatch lease is no longer owned by this worker");
      await this.appendAudit(tx, lease.workflowId, lease.tenantId, "dispatch.safe_retry_scheduled", "dispatcher", {
        attemptCount: lease.attemptCount,
        errorCode,
        retryAt: retryAt.toISOString(),
      });
      void workflow;
    });
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
        update dispatch_outbox set status = 'sent', processed_at = now(),
          leased_by = null, lease_expires_at = null
        where workflow_id = ${workflowId} and status in ('pending', 'processing', 'reconcile')
      `;
      await this.appendAudit(tx, workflowId, tenantId, "dispatch.sent", "dispatcher", { providerEnvelopeId });
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
