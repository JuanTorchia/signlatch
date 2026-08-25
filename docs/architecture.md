# Architecture and trust boundaries

## Challenge constraint

Foxit does not prescribe a framework, cloud provider or diagram format. It does prescribe an architectural boundary:

- Foxit's open-source MCP server handles reversible PDF work.
- Signing is intentionally not included in that MCP catalog.
- The application calls Foxit eSign directly with server-side credentials.
- A person must sign the document.
- The submission should make the handoff defensible and visible.

## Proposed system

```mermaid
flowchart LR
  U[User prompt] --> A[Agent orchestrator]
  A --> M[Foxit PDF MCP]
  M --> D[Prepared document]
  D --> P[Deterministic policy engine]
  P --> R[Review surface]
  R -->|approval bound to hash| L[Human latch]
  L --> E[Foxit eSign API]
  E --> S[Human signer]
  E --> W[Signed webhook]
  W --> V[HMAC verification]
  V --> T[Audit trail and executed PDF]
```

## Authority model

The agent may prepare documents, propose recipients and fields, run deterministic checks, and explain findings. It may not approve its own output, change recipients after approval, send a different artifact, invoke eSign without a valid unconsumed approval, or present an LLM risk score as legal advice.

## Approval invariant

```text
SHA-256("signlatch:approval:v1\n" + canonical-json(approval envelope))
```

The versioned envelope binds the tenant, workflow, immutable document byte hash,
ordered recipients, signer fields, delivery options, policy ruleset hash,
approval identity, approver identity, expiry and Foxit account. The canonical
encoding is implemented in `src/core/approval/envelope.ts` and locked by golden
vectors.

Any bound change invalidates the approval and returns the workflow to review.
The future eSign dispatcher must atomically consume the approval exactly once.
An ambiguous provider timeout enters reconciliation and must never cause a new
send with a new idempotency key.

## State model

```mermaid
stateDiagram-v2
  [*] --> preparing
  preparing --> review
  review --> approved: authorized human approves exact envelope
  approved --> review: bound value changes or approval expires
  approved --> dispatching: atomic compare-and-swap
  dispatching --> sent: provider envelope recorded
  dispatching --> reconcile: provider result is ambiguous
  reconcile --> sent: existing provider envelope found
  reconcile --> failed: provider confirms no envelope
  sent --> completed: verified terminal webhook
```

The application must fail closed for transitions not shown here. The dispatcher
will use a durable outbox and a stable provider idempotency key derived from the
approval ID. The current in-memory harness demonstrates semantics only; it is
not production persistence.

## Planned components

- Next.js App Router web application.
- Node.js route handlers for server-only integrations.
- Foxit PDF API MCP client for reversible operations.
- Deterministic policy engine with versioned findings.
- Persistence for document state, approval and webhook idempotency.
- Foxit eSign adapter isolated from the agent tool registry.
- HMAC-verified webhook endpoint.
- Event timeline for final demo and audit evidence.

## Required runtime evidence

- Prompt-to-document flow using real Foxit MCP operations.
- Blocked signing before human approval.
- Visible document hash, recipients and findings at approval time.
- Successful direct eSign handoff after approval.
- Verified completion webhook, executed PDF and activity history.
- Negative tests for changed artifacts, changed recipients, replayed approvals and invalid webhook signatures.

## Architecture gates

The dispatcher cannot be enabled until the approval contract, state transition
contract, authentication boundary, immutable artifact store and durable
idempotency design have tests. Webhook processing additionally requires raw-body
signature fixtures and replay tests. See [roadmap.md](roadmap.md).
