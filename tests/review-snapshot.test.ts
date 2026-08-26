import assert from "node:assert/strict";
import test from "node:test";

import { createReviewSnapshot, diffReviewSnapshots } from "../src/core/agreement/review";
import { completeAgreementFixture } from "./fixtures/agreement";

test("snapshot digest binds intent, artifact, recipients, fields, findings, and provenance", () => {
  const base = createReviewSnapshot({
    workflowId: "workflow-1",
    intent: completeAgreementFixture(),
    artifactSha256: "b".repeat(64),
    recipients: [{ id: "buyer-signer", email: "alex@example.invalid", order: 1 }],
    fields: [{ id: "signature-1", recipientId: "buyer-signer", page: 1, rectangle: [100, 700, 300, 760] }],
    findings: [],
    provenanceSha256: "c".repeat(64),
  });
  const changed = createReviewSnapshot({ ...base.input, artifactSha256: "d".repeat(64) });
  assert.notEqual(base.digest, changed.digest);
});

test("material diff identifies recipient and artifact changes", () => {
  const before = createReviewSnapshot({ workflowId: "workflow-1", intent: completeAgreementFixture(), artifactSha256: "b".repeat(64), recipients: [{ id: "buyer-signer", email: "alex@example.invalid", order: 1 }], fields: [], findings: [], provenanceSha256: "c".repeat(64) });
  const after = createReviewSnapshot({ ...before.input, artifactSha256: "d".repeat(64), recipients: [{ id: "buyer-signer", email: "changed@example.invalid", order: 1 }] });
  assert.deepEqual(diffReviewSnapshots(before, after).map((entry) => entry.category), ["artifact", "recipients"]);
});
