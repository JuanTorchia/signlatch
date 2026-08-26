import type { JSONValue, Sql } from "postgres";

import { SecurityStore, type ProviderOperationKind } from "./security-store";

export class ProviderOperations {
  private readonly security: SecurityStore;
  constructor(private readonly sql: Sql) {
    this.security = new SecurityStore(sql);
  }

  reserve(input: {
    tenantId: string;
    kind: ProviderOperationKind;
    idempotencyKey: string;
    requestDigest: string;
    now: Date;
  }) {
    return this.security.reserveProviderOperation(input);
  }

  async start(operationId: string, workerId: string, now: Date, leaseSeconds = 120): Promise<ProviderOperationLease | null> {
    const rows = await this.sql<Array<{ operation_id: string; lease_generation: number | string }>>`
      update provider_operations
      set state = 'running', leased_by = ${workerId},
          lease_generation = lease_generation + 1,
          lease_expires_at = ${new Date(now.getTime() + leaseSeconds * 1000)}, updated_at = now()
      where operation_id = ${operationId} and state = 'reserved'
      returning operation_id, lease_generation
    `;
    return rows[0] ? {
      operationId: rows[0].operation_id,
      workerId,
      generation: Number(rows[0].lease_generation),
    } : null;
  }

  async succeed(lease: ProviderOperationLease, resultDigest: string, payload: Record<string, unknown>): Promise<void> {
    await this.sql.begin(async (tx) => {
      const rows = await tx<Array<{ tenant_id: string; operation_kind: string; reserved_units: number; created_at: Date }>>`
        update provider_operations set state = 'succeeded', result_digest = ${resultDigest},
          result_payload = ${tx.json(payload as JSONValue)}, leased_by = null,
          lease_expires_at = null, updated_at = now()
        where operation_id = ${lease.operationId} and state = 'running'
          and leased_by = ${lease.workerId} and lease_generation = ${lease.generation}
        returning tenant_id, operation_kind, reserved_units, created_at
      `;
      const operation = rows[0];
      if (!operation) throw new Error("Provider operation lease is no longer owned");
      const periodStart = new Date(Date.UTC(operation.created_at.getUTCFullYear(), operation.created_at.getUTCMonth(), operation.created_at.getUTCDate()));
      await tx`
        update provider_budgets set reserved = reserved - ${operation.reserved_units},
          consumed = consumed + ${operation.reserved_units}, version = version + 1
        where tenant_id = ${operation.tenant_id} and provider = 'foxit'
          and operation_kind = ${operation.operation_kind} and period_start = ${periodStart}
      `;
    });
  }

  async reconcile(lease: ProviderOperationLease): Promise<void> {
    await this.sql`
      update provider_operations set state = 'reconcile', leased_by = null,
        lease_expires_at = null, updated_at = now()
      where operation_id = ${lease.operationId} and state = 'running'
        and leased_by = ${lease.workerId} and lease_generation = ${lease.generation}
    `;
  }

  async releaseReservation(operationId: string, reason = "reservation-released"): Promise<void> {
    await this.sql.begin(async (tx) => {
      const rows = await tx<Array<{ tenant_id: string; operation_kind: string; reserved_units: number; created_at: Date }>>`
        update provider_operations
        set state = 'failed', result_payload = ${tx.json({ reason })}, updated_at = now()
        where operation_id = ${operationId} and state = 'reserved'
        returning tenant_id, operation_kind, reserved_units, created_at
      `;
      const operation = rows[0];
      if (!operation) return;
      const periodStart = new Date(Date.UTC(
        operation.created_at.getUTCFullYear(),
        operation.created_at.getUTCMonth(),
        operation.created_at.getUTCDate(),
      ));
      await tx`
        update provider_budgets
        set reserved = reserved - ${operation.reserved_units}, version = version + 1
        where tenant_id = ${operation.tenant_id} and provider = 'foxit'
          and operation_kind = ${operation.operation_kind} and period_start = ${periodStart}
      `;
    });
  }
}

export type ProviderOperationLease = {
  operationId: string;
  workerId: string;
  generation: number;
};
