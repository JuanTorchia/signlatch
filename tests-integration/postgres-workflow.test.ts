import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before } from "node:test";
import postgres from "postgres";

import { PostgresWorkflowStore } from "../src/server/workflow/postgres-store";
import { approvalFixture, documentBytes } from "../tests/fixtures/approval";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for integration tests");
if (!new URL(databaseUrl).pathname.endsWith("_test")) {
  throw new Error("Integration tests require a database name ending in _test");
}

const sql = postgres(databaseUrl, { max: 8 });
const store = new PostgresWorkflowStore(sql);

before(async () => {
  const migration = readFileSync(
    new URL("../db/migrations/001_workflow_core.sql", import.meta.url),
    "utf8",
  );
  await sql.unsafe(migration);
  await sql`truncate table audit_events, dispatch_outbox, workflows restart identity cascade`;
});

after(async () => {
  await sql.end();
});

test("approval claim is atomic and creates one outbox record", async () => {
  const envelope = approvalFixture();
  await store.createReview(envelope);
  const approvedVersion = await store.approve(envelope, 1);

  const attempts = await Promise.allSettled([
    store.claimDispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z"), approvedVersion),
    store.claimDispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z"), approvedVersion),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);

  const outbox = await sql`select approval_id, idempotency_key from dispatch_outbox`;
  assert.deepEqual(Array.from(outbox), [
    { approval_id: envelope.approvalId, idempotency_key: `signlatch:${envelope.approvalId}` },
  ]);
});

test("an ambiguous provider result enters reconciliation and preserves idempotency", async () => {
  const envelope = approvalFixture();
  envelope.workflowId = "supplier-onboarding-43";
  envelope.approvalId = "approval-002";
  await store.createReview(envelope);
  const approvedVersion = await store.approve(envelope, 1);
  const claim = await store.claimDispatch(
    envelope,
    documentBytes,
    new Date("2026-08-25T12:05:00.000Z"),
    approvedVersion,
  );
  const reconcileVersion = await store.markAmbiguous(
    envelope.workflowId,
    envelope.tenantId,
    claim.version,
  );
  await store.markSent(
    envelope.workflowId,
    envelope.tenantId,
    "reconcile",
    reconcileVersion,
    "foxit-envelope-002",
  );

  const rows = await sql`select state, provider_envelope_id from workflows where workflow_id = ${envelope.workflowId}`;
  assert.deepEqual(Array.from(rows), [{ state: "sent", provider_envelope_id: "foxit-envelope-002" }]);
  const outbox = await sql`select idempotency_key, status from dispatch_outbox where workflow_id = ${envelope.workflowId}`;
  assert.deepEqual(Array.from(outbox), [{ idempotency_key: "signlatch:approval-002", status: "sent" }]);
});

test("audit events form an unbroken hash chain", async () => {
  const envelope = approvalFixture();
  envelope.workflowId = "supplier-onboarding-44";
  envelope.approvalId = "approval-003";
  await store.createReview(envelope);
  await store.approve(envelope, 1);

  const events = await sql`
    select previous_hash, event_hash from audit_events
    where workflow_id = ${envelope.workflowId} order by sequence
  `;
  assert.equal(events.length, 2);
  assert.equal(events[0].previous_hash, "0".repeat(64));
  assert.equal(events[1].previous_hash, events[0].event_hash);
});
