import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { createReviewSnapshot, type ReviewInput } from "../src/core/agreement/review";
import { ApprovalHarness } from "../src/core/approval/harness";
import type { ExactApprovalV2 } from "../src/core/approval/envelope-v2";
import { completeAgreementFixture } from "../tests/fixtures/agreement";

const base: ReviewInput = { workflowId: "fixture-workflow", intent: completeAgreementFixture(), artifactSha256: "a".repeat(64), recipients: [{ id: "signer", email: "signer@example.invalid", order: 1 }], fields: [{ id: "signature", recipientId: "signer", page: 1, rectangle: [10, 10, 20, 20] }], findings: [], provenanceSha256: "b".repeat(64) };
const original = createReviewSnapshot(base);
const approval: ExactApprovalV2 = { schema: "signlatch.exact-approval.v2", tenantId: "fixture-tenant", workflowId: base.workflowId, reviewVersion: 1, reviewDigest: original.digest, approverId: "fixture-human", nonce: "fixture-nonce-0123456789", issuedAt: "2026-08-26T12:00:00.000Z", expiresAt: "2026-08-26T12:15:00.000Z" };
const categories = ["artifact", "recipient", "field", "finding", "intent"] as const;
const results = categories.map((category) => {
  const harness = new ApprovalHarness(); harness.approveExact(approval, original);
  const changed = structuredClone(base);
  if (category === "artifact") changed.artifactSha256 = "c".repeat(64);
  if (category === "recipient") changed.recipients[0].email = "changed@example.invalid";
  if (category === "field") changed.fields[0].page = 2;
  if (category === "finding") changed.findings.push({ ruleId: "fixture-change", rulesetVersion: "supplier-v1" as const, severity: "warning" as const, message: "Material fixture change", acknowledgementRequired: true });
  if (category === "intent") changed.intent.paymentTerms = "Net 90";
  let denial = "missing"; try { harness.consumeExact(approval, createReviewSnapshot(changed), new Date("2026-08-26T12:05:00Z")); } catch (error) { denial = error instanceof Error ? error.message : "denied"; }
  let restoration = "missing"; try { harness.consumeExact(approval, original, new Date("2026-08-26T12:06:00Z")); } catch (error) { restoration = error instanceof Error ? error.message : "denied"; }
  return { category, mutation: denial, restoration };
});
const output = { schema: "signlatch.approval-harness-evidence.v1", claim: "fixture-demonstrated", generatedAt: new Date().toISOString(), originalReviewDigest: original.digest, results };
async function main() {
  const target = path.join(process.cwd(), "evidence", "approval-harness.json");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ target: path.relative(process.cwd(), target), results: results.length }));
}

void main();
