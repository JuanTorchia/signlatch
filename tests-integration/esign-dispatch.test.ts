import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach } from "node:test";
import postgres from "postgres";
import { createReviewSnapshot } from "../src/core/agreement/review";
import { ApprovalStore } from "../src/server/workflow/approval-store";
import { ESignDispatchStore } from "../src/server/workflow/esign-dispatch-store";
import { ReviewStore } from "../src/server/workflow/review-store";
import { completeAgreementFixture } from "../tests/fixtures/agreement";

const url = process.env.TEST_DATABASE_URL; if (!url) throw new Error("TEST_DATABASE_URL is required");
const sql = postgres(url, { max: 8 }); const tenant="00000000-0000-4000-8000-000000000041", operator="00000000-0000-4000-8000-000000000042", approver="00000000-0000-4000-8000-000000000043";
before(async()=>{for(const name of ["0002_secure_foundation.sql","0003_agreement_review.sql","0004_exact_approval.sql","0005_esign_dispatch.sql"]) await sql.unsafe(readFileSync(new URL(`../migrations/${name}`,import.meta.url),"utf8"));});
beforeEach(async()=>{await sql`truncate esign_dispatches, exact_approvals, review_snapshots, document_versions, agreement_intents, agreement_workflows, principals, tenants cascade`; await sql`insert into tenants (tenant_id,display_name) values (${tenant},'Dispatch')`; await sql`insert into principals (principal_id,provider,provider_subject,display_name) values (${operator},'github','42','Operator'),(${approver},'github','43','Approver')`;}); after(async()=>sql.end());

async function ready(){const bytes=Buffer.from("exact artifact"); const sha=createHash("sha256").update(bytes).digest("hex"); const reviews=new ReviewStore(sql); const intent=completeAgreementFixture(); const workflowId=await reviews.createWorkflow(tenant,operator,intent); const snapshot=createReviewSnapshot({workflowId,intent,artifactSha256:sha,recipients:[],fields:[],findings:[],provenanceSha256:"b".repeat(64)}); await reviews.savePreparedReview({workflowId,tenantId:tenant,artifactSha256:sha,actualSize:bytes.length,provenanceSha256:"b".repeat(64),snapshot}); await new ApprovalStore(sql).approveExact({schema:"signlatch.exact-approval.v2",tenantId:tenant,workflowId,reviewVersion:1,reviewDigest:snapshot.digest,approverId:approver,nonce:"dispatch-nonce-0123456789",issuedAt:"2026-08-26T12:00:00Z",expiresAt:"2026-08-26T12:15:00Z"},new Date("2026-08-26T12:05:00Z")); return {bytes,workflowId,snapshot};}
test("approval consumption and dispatch enqueue are atomic and single-use",async()=>{const f=await ready(); const store=new ESignDispatchStore(sql); const now=new Date("2026-08-26T12:05:00Z"); const results=await Promise.allSettled(Array.from({length:8},()=>store.enqueue({workflowId:f.workflowId,tenantId:tenant,expectedReviewDigest:f.snapshot.digest,artifactBytes:f.bytes,now}))); assert.equal(results.filter(x=>x.status==="fulfilled").length,1); const rows=await sql`select * from esign_dispatches`; assert.equal(rows.length,1);});
test("pre-send artifact rehash denies changed bytes without consuming approval",async()=>{const f=await ready(); await assert.rejects(()=>new ESignDispatchStore(sql).enqueue({workflowId:f.workflowId,tenantId:tenant,expectedReviewDigest:f.snapshot.digest,artifactBytes:Buffer.from("changed"),now:new Date("2026-08-26T12:05:00Z")}),/Artifact bytes/); const rows=await sql<Array<{consumed_at:Date|null}>>`select consumed_at from exact_approvals`; assert.equal(rows[0].consumed_at,null);});
