# ADR 0001: Keep signing authority outside the agent

- Status: Accepted
- Date: 2026-08-25

## Context

Foxit MCP exposes reversible document operations but intentionally excludes the
irreversible act of sending a document for signature. An agent that can prepare,
approve and dispatch the same artifact collapses proposal and authority into one
principal.

## Decision

The agent may prepare a document and propose recipients and fields. A separately
authenticated human approves a canonical envelope that binds the exact document
bytes and complete dispatch intent. A server-only dispatcher with separate Foxit
eSign credentials may consume that approval once. The eSign credential is never
available to the agent or its MCP tool registry.

## Consequences

- Document or recipient mutation requires a new human approval.
- Dispatch needs durable atomic state and provider idempotency.
- The demo can make the authority boundary visible through a blocked mutation.
- The architecture adds friction, which must be minimized through a focused
  review surface rather than by weakening the approval.
