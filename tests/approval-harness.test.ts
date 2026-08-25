import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalHarness } from "../src/core/approval/harness";
import { approvalFixture, documentBytes } from "./fixtures/approval";

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
