import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { approvalDigest, canonicalApprovalEnvelope } from "../src/core/approval/envelope";
import { approvalFixture } from "./fixtures/approval";

test("canonical encoding is stable across object key order", () => {
  const envelope = approvalFixture();
  const reordered = Object.fromEntries(Object.entries(envelope).reverse()) as typeof envelope;
  assert.equal(canonicalApprovalEnvelope(reordered), canonicalApprovalEnvelope(envelope));
  assert.equal(approvalDigest(reordered), approvalDigest(envelope));
});

test("canonical encoding matches the public golden vector", () => {
  const golden = JSON.parse(
    readFileSync(new URL("./fixtures/approval-v1.golden.json", import.meta.url), "utf8"),
  ) as { canonical: string; sha256: string };
  const envelope = approvalFixture();
  assert.equal(canonicalApprovalEnvelope(envelope), golden.canonical);
  assert.equal(approvalDigest(envelope), golden.sha256);
});

test("the digest changes when a recipient changes", () => {
  const envelope = approvalFixture();
  const changed = structuredClone(envelope);
  changed.recipients[0].email = "attacker@example.com";
  changed.fields[0].recipientEmail = "attacker@example.com";
  assert.notEqual(approvalDigest(changed), approvalDigest(envelope));
});

test("the digest changes when delivery instructions change", () => {
  const envelope = approvalFixture();
  const changed = structuredClone(envelope);
  changed.delivery.message = "Sign immediately.";
  assert.notEqual(approvalDigest(changed), approvalDigest(envelope));
});

test("fields cannot reference recipients outside the envelope", () => {
  const envelope = approvalFixture();
  envelope.fields[0].recipientEmail = "unknown@example.com";
  assert.throws(() => approvalDigest(envelope), /unknown recipient/);
});
