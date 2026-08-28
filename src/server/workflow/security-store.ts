import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";

export type Capability = "operator" | "approver" | "dispatcher" | "auditor";
export type ProviderOperationKind = "pdf-prepare" | "esign-dispatch";

export type ReservedProviderOperation = {
  operationId: string;
  state: "reserved" | "running" | "succeeded" | "failed" | "reconcile";
  requestDigest: string;
  existing: boolean;
};

type MembershipRow = { allowed: boolean };
type OperationRow = {
  operation_id: string;
  state: ReservedProviderOperation["state"];
  request_digest: string;
};

export class SecurityStore {
  constructor(private readonly sql: Sql) {}

  async hasCapability(tenantId: string, principalId: string, capability: Capability): Promise<boolean> {
    const rows = await this.sql<MembershipRow[]>`
      select exists (
        select 1 from memberships m join principals p using (principal_id)
        join tenants t using (tenant_id)
        where m.tenant_id = ${tenantId} and m.principal_id = ${principalId}
          and m.revoked_at is null and p.status = 'active' and t.status = 'active'
          and ${capability} = any(m.roles)
      ) as allowed
    `;
    return rows[0]?.allowed === true;
  }

  async ownsArtifact(tenantId: string, sha256: string): Promise<boolean> {
    const rows = await this.sql<Array<{ owned: boolean }>>`
      select exists (
        select 1 from private_artifacts
        where tenant_id = ${tenantId} and sha256 = ${sha256} and status = 'active'
      ) as owned
    `;
    return rows[0]?.owned === true;
  }

  async registerArtifact(input: {
    tenantId: string;
    sha256: string;
    storageKey: string;
    actualSize: number;
    retentionDeadline: Date;
  }): Promise<void> {
    await this.sql`
      insert into private_artifacts (
        tenant_id, sha256, storage_key, actual_size, retention_deadline
      ) values (
        ${input.tenantId}, ${input.sha256}, ${input.storageKey},
        ${input.actualSize}, ${input.retentionDeadline}
      )
      on conflict (tenant_id, sha256) do nothing
    `;
  }

  async reserveProviderOperation(input: {
    tenantId: string;
    kind: ProviderOperationKind;
    idempotencyKey: string;
    requestDigest: string;
    now: Date;
  }): Promise<ReservedProviderOperation> {
    return this.sql.begin(async (tx) => {
      await tx`
        select pg_advisory_xact_lock(
          hashtextextended(${`${input.tenantId}:${input.kind}:${input.idempotencyKey}`}, 0)
        )
      `;
      const existing = await tx<OperationRow[]>`
        select operation_id, state, request_digest from provider_operations
        where tenant_id = ${input.tenantId} and operation_kind = ${input.kind}
          and idempotency_key = ${input.idempotencyKey}
        for update
      `;
      if (existing[0]) {
        if (existing[0].request_digest !== input.requestDigest) {
          throw new Error("Idempotency key conflicts with a different request");
        }
        return mapOperation(existing[0], true);
      }

      const periodStart = new Date(Date.UTC(
        input.now.getUTCFullYear(), input.now.getUTCMonth(), input.now.getUTCDate(),
      ));
      const budgets = await tx<Array<{ hard_limit: number; consumed: number; reserved: number }>>`
        select hard_limit, consumed, reserved from provider_budgets
        where tenant_id = ${input.tenantId} and provider = 'foxit'
          and operation_kind = ${input.kind} and period_start = ${periodStart}
        for update
      `;
      const budget = budgets[0];
      if (!budget || budget.consumed + budget.reserved >= budget.hard_limit) {
        throw new Error("Provider operation budget exhausted");
      }

      const operationId = randomUUID();
      await tx`
        update provider_budgets set reserved = reserved + 1, version = version + 1
        where tenant_id = ${input.tenantId} and provider = 'foxit'
          and operation_kind = ${input.kind} and period_start = ${periodStart}
      `;
      await tx`
        insert into provider_operations (
          operation_id, tenant_id, provider, operation_kind, idempotency_key,
          request_digest, state, reserved_units, created_at, updated_at
        ) values (
          ${operationId}, ${input.tenantId}, 'foxit', ${input.kind},
          ${input.idempotencyKey}, ${input.requestDigest}, 'reserved', 1,
          ${input.now}, ${input.now}
        )
      `;
      return { operationId, state: "reserved", requestDigest: input.requestDigest, existing: false };
    });
  }
}

function mapOperation(row: OperationRow, existing: boolean): ReservedProviderOperation {
  return {
    operationId: row.operation_id,
    state: row.state,
    requestDigest: row.request_digest,
    existing,
  };
}
