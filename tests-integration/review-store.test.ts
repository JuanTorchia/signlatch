import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach } from "node:test";
import postgres from "postgres";

import { createReviewSnapshot } from "../src/core/agreement/review";
import { ReviewStore } from "../src/server/workflow/review-store";
import { completeAgreementFixture } from "../tests/fixtures/agreement";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required");
const sql = postgres(databaseUrl, { max: 4 });
const tenant = "00000000-0000-4000-8000-000000000021";
const principal = "00000000-0000-4000-8000-000000000022";

before(async () => {
  await sql.unsafe(readFileSync(new URL("../migrations/0002_secure_foundation.sql", import.meta.url), "utf8"));
  await sql.unsafe(readFileSync(new URL("../migrations/0003_agreement_review.sql", import.meta.url), "utf8"));
});
beforeEach(async () => {
  await sql`truncate review_snapshots, document_versions, agreement_intents, agreement_workflows, security_audit_events, private_artifacts, provider_operations, provider_budgets, memberships, principals, tenants cascade`;
  await sql`insert into tenants (tenant_id, display_name) values (${tenant}, 'Review')`;
  await sql`insert into principals (principal_id, provider, provider_subject, display_name) values (${principal}, 'github', '22', 'Reviewer')`;
});
after(async () => sql.end());

test("immutable intent and exact review persist under tenant ownership", async () => {
  const store = new ReviewStore(sql);
  const intent = completeAgreementFixture();
  const workflowId = await store.createWorkflow(tenant, principal, intent);
  const current = await store.getOwnedIntent(workflowId, tenant);
  assert.equal(current?.intent.supplier.name, intent.supplier.name);
  assert.equal(await store.getOwnedIntent(workflowId, "00000000-0000-4000-8000-000000000099"), null);
  const snapshot = createReviewSnapshot({ workflowId, intent, artifactSha256: "b".repeat(64), recipients: [{ id: "buyer-signer", email: "alex@example.invalid", order: 1 }], fields: [], findings: [], provenanceSha256: "c".repeat(64) });
  await store.savePreparedReview({ workflowId, tenantId: tenant, artifactSha256: "b".repeat(64), actualSize: 100, provenanceSha256: "c".repeat(64), snapshot });
  const review = await store.getReview(workflowId, tenant);
  assert.equal(review?.snapshot_digest, snapshot.digest);
});
