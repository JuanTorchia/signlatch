import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalHarness } from "../src/core/approval/harness";
import { approvalFixture, documentBytes } from "./fixtures/approval";
import { createReviewSnapshot, type ReviewInput } from "../src/core/agreement/review";
import type { ExactApprovalV2 } from "../src/core/approval/envelope-v2";
import { completeAgreementFixture } from "./fixtures/agreement";

function reviewInput(): ReviewInput {
  return { workflowId: "workflow-v2", intent: completeAgreementFixture(), artifactSha256: "b".repeat(64),
    recipients: [{ id: "buyer", email: "buyer@example.invalid", order: 1 }],
    fields: [{ id: "signature", recipientId: "buyer", page: 1, rectangle: [1, 2, 3, 4] }],
    findings: [], provenanceSha256: "c".repeat(64) };
}

function exactApproval(reviewDigest: string): ExactApprovalV2 {
  return { schema: "signlatch.exact-approval.v2", tenantId: "tenant", workflowId: "workflow-v2",
    reviewVersion: 1, reviewDigest, approverId: "human", nonce: "nonce-0123456789abcdef",
    issuedAt: "2026-08-26T12:00:00.000Z", expiresAt: "2026-08-26T12:15:00.000Z" };
}

test("dispatch returns a stable provider idempotency key", () => {
  const harness = new ApprovalHarness();
  const envelope = approvalFixture();
  harness.approve(envelope);
  assert.equal(
    harness.dispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z")),
    "signlatch:approval-001",
  );
});

test("mutated document bytes are blocked", () => {
  const harness = new ApprovalHarness();
  const envelope = approvalFixture();
  harness.approve(envelope);
  assert.throws(
    () => harness.dispatch(envelope, new TextEncoder().encode("supplier agreement v2"), new Date("2026-08-25T12:05:00.000Z")),
    /approved artifact/,
  );
});

test("recipient substitution after approval is blocked", () => {
  const harness = new ApprovalHarness();
  const envelope = approvalFixture();
  harness.approve(envelope);
  envelope.recipients[0].email = "attacker@example.com";
  envelope.fields[0].recipientEmail = "attacker@example.com";
  assert.throws(
    () => harness.dispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z")),
    /changed after human approval/,
  );
});

test("expired approvals are blocked", () => {
  const harness = new ApprovalHarness();
  const envelope = approvalFixture();
  harness.approve(envelope);
  assert.throws(
    () => harness.dispatch(envelope, documentBytes, new Date("2026-08-25T12:16:00.000Z")),
    /expired/,
  );
});

test("an approval cannot be replayed", () => {
  const harness = new ApprovalHarness();
  const envelope = approvalFixture();
  harness.approve(envelope);
  harness.dispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z"));
  assert.throws(
    () => harness.dispatch(envelope, documentBytes, new Date("2026-08-25T12:06:00.000Z")),
    /already been consumed/,
  );
});

for (const category of ["artifact", "recipient", "field", "finding", "intent"] as const) {
  test(`exact approval rejects ${category} mutation and restoration cannot revive it`, () => {
    const harness = new ApprovalHarness();
    const originalInput = reviewInput();
    const original = createReviewSnapshot(originalInput);
    const approval = exactApproval(original.digest);
    harness.approveExact(approval, original);
    const changed = structuredClone(originalInput);
    if (category === "artifact") changed.artifactSha256 = "d".repeat(64);
    if (category === "recipient") changed.recipients[0].email = "attacker@example.invalid";
    if (category === "field") changed.fields[0].page = 2;
    if (category === "finding") changed.findings.push({ ruleId: "new", rulesetVersion: "supplier-v1", severity: "warning", message: "Changed", acknowledgementRequired: true });
    if (category === "intent") changed.intent.paymentTerms = "Net 90";
    assert.throws(() => harness.consumeExact(approval, createReviewSnapshot(changed), new Date("2026-08-26T12:05:00Z")), /changed/);
    assert.throws(() => harness.consumeExact(approval, original, new Date("2026-08-26T12:06:00Z")), /consumed/);
  });
}
