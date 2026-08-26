import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIT_GENESIS,
  auditEventHash,
  redactAuditData,
  verifyAuditChain,
  type AuditEventInput,
} from "../src/core/workflow/audit";

const event: AuditEventInput = {
  eventId: "event-1",
  workflowId: "workflow-1",
  tenantId: "tenant-1",
  type: "approval.granted",
  actorId: "approver-1",
  actorRole: "approver",
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

test("audit chain verification detects sequence mutation", () => {
  const firstHash = auditEventHash(AUDIT_GENESIS, event);
  const second = { ...event, eventId: "event-2", occurredAt: "2026-08-25T12:00:01.000Z" };
  const secondHash = auditEventHash(firstHash, second);
  assert.equal(verifyAuditChain([
    { previousHash: AUDIT_GENESIS, event, hash: firstHash },
    { previousHash: firstHash, event: second, hash: secondHash },
  ]), true);
  assert.equal(verifyAuditChain([
    { previousHash: AUDIT_GENESIS, event, hash: firstHash },
    { previousHash: AUDIT_GENESIS, event: second, hash: secondHash },
  ]), false);
});

test("audit redaction removes secret and private document fields recursively", () => {
  assert.deepEqual(
    redactAuditData({ token: "secret", nested: { clientSecret: "secret", digest: "safe" }, documentText: "private" }),
    { token: "[REDACTED]", nested: { clientSecret: "[REDACTED]", digest: "safe" }, documentText: "[REDACTED]" },
  );
});
