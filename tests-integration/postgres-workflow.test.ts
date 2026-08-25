import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach } from "node:test";
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
  const leaseMigration = readFileSync(
    new URL("../db/migrations/002_outbox_leases.sql", import.meta.url),
    "utf8",
  );
  await sql.unsafe(leaseMigration);
  const fencingMigration = readFileSync(
    new URL("../db/migrations/003_lease_fencing.sql", import.meta.url),
    "utf8",
  );
  await sql.unsafe(fencingMigration);
});

beforeEach(async () => {
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
  await store.claimDispatch(
    envelope,
    documentBytes,
    new Date("2026-08-25T12:05:00.000Z"),
    approvedVersion,
  );
  const lease = await store.leaseNextDispatch(
    "worker-reconcile",
    new Date("2030-01-01T00:00:00.000Z"),
    30,
    3,
  );
  assert.ok(lease);
  const reconcileVersion = await store.markAmbiguous(lease);
  await store.markReconciledSent(
    envelope.workflowId,
    envelope.tenantId,
    reconcileVersion,
    "foxit-envelope-002",
  );

  const rows = await sql`select state, provider_envelope_id from workflows where workflow_id = ${envelope.workflowId}`;
  assert.deepEqual(Array.from(rows), [{ state: "sent", provider_envelope_id: "foxit-envelope-002" }]);
  const outbox = await sql`select idempotency_key, status from dispatch_outbox where workflow_id = ${envelope.workflowId}`;
  assert.deepEqual(Array.from(outbox), [{ idempotency_key: "signlatch:approval-002", status: "sent" }]);
});

test("an expired lease moves to reconciliation and is never re-dispatched", async () => {
  const envelope = approvalFixture();
  envelope.workflowId = "supplier-onboarding-47";
  envelope.approvalId = "approval-006";
  await store.createReview(envelope);
  const approvedVersion = await store.approve(envelope, 1);
  await store.claimDispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z"), approvedVersion);
  const lease = await store.leaseNextDispatch(
    "worker-crashed",
    new Date("2030-01-01T00:00:00.000Z"),
    30,
    3,
  );
  assert.ok(lease);

  assert.equal(
    await store.reconcileNextExpiredLease(new Date("2030-01-01T00:01:00.000Z")),
    lease.outboxId,
  );
  assert.equal(
    await store.leaseNextDispatch("worker-new", new Date("2030-01-01T00:02:00.000Z"), 30, 3),
    null,
  );
  const rows = await sql`
    select workflows.state, dispatch_outbox.status, dispatch_outbox.last_error
    from workflows join dispatch_outbox using (workflow_id)
    where workflows.workflow_id = ${envelope.workflowId}
  `;
  assert.deepEqual(Array.from(rows), [{
    state: "reconcile",
    status: "reconcile",
    last_error: "lease-expired",
  }]);
});

test("a late worker cannot complete after its lease was recovered", async () => {
  const envelope = approvalFixture();
  envelope.workflowId = "supplier-onboarding-48";
  envelope.approvalId = "approval-007";
  await store.createReview(envelope);
  const approvedVersion = await store.approve(envelope, 1);
  await store.claimDispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z"), approvedVersion);
  const staleLease = await store.leaseNextDispatch(
    "worker-stale",
    new Date("2030-01-01T00:00:00.000Z"),
    30,
    3,
  );
  assert.ok(staleLease);
  await store.reconcileNextExpiredLease(new Date("2030-01-01T00:01:00.000Z"));

  await assert.rejects(
    store.markSent(staleLease, "foxit-envelope-late"),
    /state or version conflict/,
  );
});

test("a prior lease generation cannot complete a later attempt", async () => {
  const envelope = approvalFixture();
  envelope.workflowId = "supplier-onboarding-49";
  envelope.approvalId = "approval-008";
  await store.createReview(envelope);
  const approvedVersion = await store.approve(envelope, 1);
  await store.claimDispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z"), approvedVersion);
  const firstLease = await store.leaseNextDispatch(
    "worker-same",
    new Date("2030-01-01T00:00:00.000Z"),
    30,
    3,
  );
  assert.ok(firstLease);
  await store.releaseSafeFailure(firstLease, new Date("2030-01-01T00:01:00.000Z"), "preflight");
  const secondLease = await store.leaseNextDispatch(
    "worker-same",
    new Date("2030-01-01T00:02:00.000Z"),
    30,
    3,
  );
  assert.ok(secondLease);
  assert.equal(secondLease.leaseGeneration, firstLease.leaseGeneration + 1);

  await assert.rejects(
    store.markSent(firstLease, "foxit-envelope-stale"),
    /no longer owned/,
  );
  await store.markSent(secondLease, "foxit-envelope-current");
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

test("concurrent workers cannot lease the same outbox item", async () => {
  const envelope = approvalFixture();
  envelope.workflowId = "supplier-onboarding-45";
  envelope.approvalId = "approval-004";
  await store.createReview(envelope);
  const approvedVersion = await store.approve(envelope, 1);
  await store.claimDispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z"), approvedVersion);

  const leases = await Promise.all([
    store.leaseNextDispatch("worker-a", new Date("2030-01-01T00:00:00.000Z"), 30, 3),
    store.leaseNextDispatch("worker-b", new Date("2030-01-01T00:00:00.000Z"), 30, 3),
  ]);
  assert.equal(leases.filter(Boolean).length, 1);
  assert.equal(leases.filter((lease) => lease === null).length, 1);
});

test("safe failures release the lease with the same idempotency key", async () => {
  const envelope = approvalFixture();
  envelope.workflowId = "supplier-onboarding-46";
  envelope.approvalId = "approval-005";
  await store.createReview(envelope);
  const approvedVersion = await store.approve(envelope, 1);
  await store.claimDispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z"), approvedVersion);
  const lease = await store.leaseNextDispatch(
    "worker-a",
    new Date("2030-01-01T00:00:00.000Z"),
    30,
    3,
  );
  assert.ok(lease);
  await store.releaseSafeFailure(lease, new Date("2030-01-01T00:01:00.000Z"), "preflight");

  const rows = await sql`
    select status, idempotency_key, attempt_count, leased_by
    from dispatch_outbox where workflow_id = ${envelope.workflowId}
  `;
  assert.deepEqual(Array.from(rows), [{
    status: "pending",
    idempotency_key: "signlatch:approval-005",
    attempt_count: 1,
    leased_by: null,
  }]);
});
