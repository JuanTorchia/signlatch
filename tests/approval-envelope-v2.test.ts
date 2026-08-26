import assert from "node:assert/strict";
import test from "node:test";

import { canonicalExactApproval, exactApprovalDigest, type ExactApprovalV2 } from "../src/core/approval/envelope-v2";

const approval: ExactApprovalV2 = {
  schema: "signlatch.exact-approval.v2", tenantId: "tenant", workflowId: "workflow",
  reviewVersion: 3, reviewDigest: "a".repeat(64), approverId: "approver",
  nonce: "nonce-0123456789abcdef", issuedAt: "2026-08-26T12:00:00.000Z", expiresAt: "2026-08-26T12:15:00.000Z",
};

test("approval v2 has a stable canonical vector", () => {
  assert.equal(canonicalExactApproval(approval), '{"approverId":"approver","expiresAt":"2026-08-26T12:15:00.000Z","issuedAt":"2026-08-26T12:00:00.000Z","nonce":"nonce-0123456789abcdef","reviewDigest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","reviewVersion":3,"schema":"signlatch.exact-approval.v2","tenantId":"tenant","workflowId":"workflow"}');
  assert.equal(exactApprovalDigest(approval).length, 64);
});

test("v2 is domain-separated and binds the exact review", () => {
  assert.notEqual(exactApprovalDigest(approval), exactApprovalDigest({ ...approval, reviewDigest: "b".repeat(64) }));
  assert.throws(() => canonicalExactApproval({ ...approval, schema: "signlatch.approval.v1" as never }), /schema/);
});
