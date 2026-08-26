import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach } from "node:test";
import postgres from "postgres";

import { SecurityStore } from "../src/server/workflow/security-store";
import { ProviderOperations } from "../src/server/workflow/provider-operations";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for integration tests");
const sql = postgres(databaseUrl, { max: 20 });
const tenant = "00000000-0000-4000-8000-000000000011";
const now = new Date("2026-08-26T12:00:00.000Z");

before(async () => sql.unsafe(readFileSync(new URL("../migrations/0002_secure_foundation.sql", import.meta.url), "utf8")));
beforeEach(async () => {
  await sql`truncate security_audit_events, private_artifacts, provider_operations, provider_budgets, memberships, principals, tenants cascade`;
  await sql`insert into tenants (tenant_id, display_name) values (${tenant}, 'Budget')`;
  await sql`insert into provider_budgets (tenant_id, provider, operation_kind, period_start, period_end, hard_limit) values (${tenant}, 'foxit', 'pdf-prepare', ${new Date('2026-08-26T00:00:00Z')}, ${new Date('2026-08-27T00:00:00Z')}, 5)`;
});
after(async () => sql.end());

test("twenty concurrent identical requests reserve one unit", async () => {
  const stores = Array.from({ length: 20 }, () => new SecurityStore(sql));
  const results = await Promise.all(stores.map((store) => store.reserveProviderOperation({
    tenantId: tenant,
    kind: "pdf-prepare",
    idempotencyKey: "same-request-key-0001",
    requestDigest: "c".repeat(64),
    now,
  })));
  assert.equal(new Set(results.map((result) => result.operationId)).size, 1);
  const budgets = await sql`select reserved from provider_budgets where tenant_id = ${tenant}`;
  assert.equal(budgets[0].reserved, 1);
});

test("same idempotency key rejects a different request digest", async () => {
  const store = new SecurityStore(sql);
  await store.reserveProviderOperation({ tenantId: tenant, kind: "pdf-prepare", idempotencyKey: "conflict-key-000001", requestDigest: "d".repeat(64), now });
  await assert.rejects(store.reserveProviderOperation({ tenantId: tenant, kind: "pdf-prepare", idempotencyKey: "conflict-key-000001", requestDigest: "e".repeat(64), now }), /conflicts/);
});

test("lease generation fences late completion and consumes budget once", async () => {
  const service = new ProviderOperations(sql);
  const reservation = await service.reserve({ tenantId: tenant, kind: "pdf-prepare", idempotencyKey: "lease-fence-key-001", requestDigest: "f".repeat(64), now });
  const lease = await service.start(reservation.operationId, "worker-1", now);
  assert.ok(lease);
  await assert.rejects(
    service.succeed({ ...lease, generation: lease.generation + 1 }, "a".repeat(64), {}),
    /no longer owned/,
  );
  await service.succeed(lease, "a".repeat(64), { artifact: "safe" });
  const rows = await sql`select state, result_digest from provider_operations where operation_id = ${reservation.operationId}`;
  assert.deepEqual(Array.from(rows), [{ state: "succeeded", result_digest: "a".repeat(64) }]);
  const budgets = await sql`select consumed, reserved from provider_budgets where tenant_id = ${tenant}`;
  assert.deepEqual(Array.from(budgets), [{ consumed: 1, reserved: 0 }]);
});
