import assert from "node:assert/strict";
import test from "node:test";

import { AUDIT_GENESIS, auditEventHash, type AuditEventInput } from "../src/core/workflow/audit";

const event: AuditEventInput = {
  eventId: "event-1",
  workflowId: "workflow-1",
  tenantId: "tenant-1",
  type: "approval.granted",
  actorId: "approver-1",
  occurredAt: "2026-08-25T12:00:00.000Z",
  data: { approvalId: "approval-1", digest: "abc" },
};

test("audit hashes are deterministic", () => {
  assert.equal(auditEventHash(AUDIT_GENESIS, event), auditEventHash(AUDIT_GENESIS, event));
});

test("audit mutation changes the event hash", () => {
  const changed = structuredClone(event);
  changed.data.approvalId = "approval-2";
  assert.notEqual(auditEventHash(AUDIT_GENESIS, changed), auditEventHash(AUDIT_GENESIS, event));
});

test("audit ordering is bound through the previous hash", () => {
  assert.notEqual(auditEventHash("1".repeat(64), event), auditEventHash(AUDIT_GENESIS, event));
});
