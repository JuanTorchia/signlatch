import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach } from "node:test";
import postgres from "postgres";

import { createReviewSnapshot } from "../src/core/agreement/review";
import type { ExactApprovalV2 } from "../src/core/approval/envelope-v2";
import { ApprovalStore } from "../src/server/workflow/approval-store";
import { ReviewStore } from "../src/server/workflow/review-store";
import { completeAgreementFixture } from "../tests/fixtures/agreement";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is required");
const sql = postgres(url, { max: 4 });
const tenant = "00000000-0000-4000-8000-000000000031";
const operator = "00000000-0000-4000-8000-000000000032";
const approver = "00000000-0000-4000-8000-000000000033";

before(async () => { for (const migration of ["0002_secure_foundation.sql", "0003_agreement_review.sql", "0004_exact_approval.sql"]) await sql.unsafe(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), "utf8")); });
beforeEach(async () => {
  await sql`truncate exact_approvals, review_snapshots, document_versions, agreement_intents, agreement_workflows, memberships, principals, tenants cascade`;
  await sql`insert into tenants (tenant_id, display_name) values (${tenant}, 'Approval')`;
  await sql`insert into principals (principal_id, provider, provider_subject, display_name) values (${operator}, 'github', '32', 'Operator'), (${approver}, 'github', '33', 'Approver')`;
});
after(async () => sql.end());

async function fixture() {
  const reviews = new ReviewStore(sql); const intent = completeAgreementFixture();
  const workflowId = await reviews.createWorkflow(tenant, operator, intent);
  const snapshot = createReviewSnapshot({ workflowId, intent, artifactSha256: "a".repeat(64), recipients: [], fields: [], findings: [], provenanceSha256: "b".repeat(64) });
  await reviews.savePreparedReview({ workflowId, tenantId: tenant, artifactSha256: "a".repeat(64), actualSize: 100, provenanceSha256: "b".repeat(64), snapshot });
  const value: ExactApprovalV2 = { schema: "signlatch.exact-approval.v2", tenantId: tenant, workflowId, reviewVersion: 1, reviewDigest: snapshot.digest, approverId: approver, nonce: "integration-nonce-012345", issuedAt: "2026-08-26T12:00:00Z", expiresAt: "2026-08-26T12:15:00Z" };
  return { reviews, snapshot, value };
}

test("exact approval is one-way and stale review is rejected", async () => {
  const { reviews, value } = await fixture(); const approvals = new ApprovalStore(sql);
  const now = new Date("2026-08-26T12:05:00Z");
  const granted = await approvals.approveExact(value, now); assert.equal(granted.generation, 1);
  await assert.rejects(() => approvals.approveExact({ ...value, nonce: "integration-nonce-999999" }, now), /awaiting approval/);
  await reviews.createMutation(value.workflowId, tenant, (input) => ({ ...input, artifactSha256: "c".repeat(64) }));
  await assert.rejects(() => approvals.approveExact({ ...value, nonce: "integration-nonce-888888" }, now), /stale/);
  const rows = await sql<Array<{ invalidated_at: Date | null }>>`select invalidated_at from exact_approvals`;
  assert.ok(rows[0].invalidated_at);
});

test("expired exact approval is rejected without changing workflow authority", async () => {
  const { value } = await fixture();
  await assert.rejects(() => new ApprovalStore(sql).approveExact(value, new Date("2026-08-26T12:16:00Z")), /expired/);
  const rows = await sql<Array<{ state: string; active_approval_id: string | null }>>`select state, active_approval_id from agreement_workflows`;
  assert.deepEqual(rows[0], { state: "review", active_approval_id: null });
});
