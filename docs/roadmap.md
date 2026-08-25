# Evidence-driven roadmap

Each milestone must remain truthful in the public repository. A planned control
is not marked complete until code, tests and reproducible evidence exist.

## M1 — Authority contract and harness

- [x] Versioned, domain-separated approval envelope
- [x] Exact document-byte digest
- [x] Recipient, field, delivery, policy and provider binding
- [x] Mutation, expiry and replay negative tests
- [x] Executable public harness
- [x] Cross-runtime golden vector fixture

## M2 — Durable workflow core

- [ ] Explicit fail-closed state machine
- [ ] Transactional compare-and-swap for approval consumption
- [ ] Durable outbox and stable provider idempotency key
- [ ] Ambiguous-timeout reconciliation path
- [ ] Append-only audit event schema

## M3 — Real Foxit preparation

- [ ] Foxit MCP client configured without eSign authority
- [ ] One or two visible reversible PDF operations
- [ ] Immutable artifact storage and provenance
- [ ] Prompt-injection and hostile-PDF controls
- [ ] Reproducible MCP call evidence

## M4 — Human review and eSign

- [ ] Authenticated and authorized approval surface
- [ ] Complete bound payload and material diff shown to the approver
- [ ] Isolated direct Foxit eSign adapter
- [ ] Mutation and replay blocked in the real workflow
- [ ] Human signer completes the provider flow

## M5 — Verified completion and submission evidence

- [ ] Raw-body webhook verification and replay defense
- [ ] Monotonic event processing and provider correlation
- [ ] Executed PDF retrieval and digest
- [ ] End-to-end browser journey and negative demo
- [ ] Reproducible setup, architecture diagram and three-minute demo
- [ ] Concrete procurement buyer story with measurable value
