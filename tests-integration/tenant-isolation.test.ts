import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach } from "node:test";
import postgres from "postgres";

import { SecurityStore } from "../src/server/workflow/security-store";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for integration tests");
if (!new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("Test database suffix required");
const sql = postgres(databaseUrl, { max: 4 });
const store = new SecurityStore(sql);
const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const principal = "00000000-0000-4000-8000-000000000003";
const digest = "a".repeat(64);

before(async () => sql.unsafe(readFileSync(new URL("../migrations/0002_secure_foundation.sql", import.meta.url), "utf8")));
beforeEach(async () => {
  await sql`truncate security_audit_events, private_artifacts, provider_operations, provider_budgets, memberships, principals, tenants cascade`;
  await sql`insert into tenants (tenant_id, display_name) values (${tenantA}, 'A'), (${tenantB}, 'B')`;
  await sql`insert into principals (principal_id, provider, provider_subject, display_name) values (${principal}, 'github', '1', 'Owner')`;
  await sql`insert into memberships (tenant_id, principal_id, roles) values (${tenantA}, ${principal}, array['operator'])`;
  await sql`insert into private_artifacts (tenant_id, sha256, storage_key, actual_size, retention_deadline) values (${tenantA}, ${digest}, 'sha256/a.pdf', 100, now() + interval '7 days')`;
});
after(async () => sql.end());

test("membership is tenant-scoped and revocation is immediate", async () => {
  assert.equal(await store.hasCapability(tenantA, principal, "operator"), true);
  assert.equal(await store.hasCapability(tenantB, principal, "operator"), false);
  await sql`update memberships set revoked_at = now() where tenant_id = ${tenantA}`;
  assert.equal(await store.hasCapability(tenantA, principal, "operator"), false);
});

test("artifact ownership does not cross tenant boundaries", async () => {
  assert.equal(await store.ownsArtifact(tenantA, digest), true);
  assert.equal(await store.ownsArtifact(tenantB, digest), false);
  assert.equal(await store.ownsArtifact(tenantA, "b".repeat(64)), false);
});
