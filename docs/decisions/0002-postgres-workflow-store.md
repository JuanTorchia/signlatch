# ADR 0002: Use Postgres for workflow authority state

- Status: Accepted
- Date: 2026-08-25

## Context

Approval consumption and eSign dispatch cannot rely on process memory. Multiple
workers, retries and crashes must still preserve one approval to at most one
provider envelope. The state transition, outbox entry and audit event need one
transactional boundary.

## Decision

Use Postgres as the authority store. Lock the workflow row, verify its expected
version and state, then transition to `dispatching`, create the unique outbox
entry and append the audit event in one transaction. Provider idempotency uses
the stable approval ID. Ambiguous provider responses transition to `reconcile`;
they never create a fresh send.

The SQL schema is provider-neutral and checked in under `db/migrations`. CI runs
integration tests against a real Postgres service rather than a mock database.

## Consequences

- Production deployment requires managed Postgres and migration automation.
- Optimistic version checks make stale clients fail closed.
- Unique constraints provide a second defense against duplicate approval use.
- The outbox worker and provider adapter remain separate future components.
