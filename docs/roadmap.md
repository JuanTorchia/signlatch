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

- [x] Explicit fail-closed state machine
- [x] Transactional compare-and-swap for approval consumption
- [x] Durable outbox and stable provider idempotency key
- [x] Ambiguous-timeout reconciliation path
- [x] Append-only audit event schema
- [ ] Production database provisioning and migration automation
- [x] Outbox worker lease and retry budget
- [x] Fail-closed provider adapter contract
- [x] Expired-lease recovery with generation fencing
- [ ] Provider reconciliation adapter

## M3 — Real Foxit preparation

- [x] Foxit MCP client configured without eSign authority
- [ ] One visible reversible PDF operation through the real Foxit service
- [x] Immutable content-addressed artifact storage and provenance contract
- [x] Fixed tool allowlist, inert prompt data and PDF-signature validation
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
