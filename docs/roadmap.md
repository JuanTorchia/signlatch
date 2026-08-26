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
- [x] Production database provisioning with verified backup and restored dump
- [x] Transactional, locked and checksum-verified migration automation
- [x] Outbox worker lease and retry budget
- [x] Fail-closed provider adapter contract
- [x] Expired-lease recovery with generation fencing
- [x] Provider correlation reconciliation adapter (fixture-tested; live gate disabled)

## M3 — Real Foxit preparation

- [x] Foxit MCP client configured without eSign authority
- [x] One visible reversible PDF operation through the real Foxit service
- [x] Immutable content-addressed artifact storage and provenance contract
- [x] Fixed tool allowlist, inert prompt data and PDF-signature validation
- [x] Reproducible MCP call evidence
- [x] Judge-visible prompt and review surface behind an explicit credit gate
- [x] Bounded MCP calls, strict tool results and baseline hostile-PDF rejection
- [x] Sandboxed parser validation and scheduled Foxit document retention cleanup

## M4 — Human review and eSign

- [x] Authenticated and authorized approval surface
- [x] Complete bound payload and material diff shown to the approver
- [x] Isolated direct Foxit eSign adapter (fixture-tested; live gate disabled)
- [x] Mutation and replay blocked in the durable workflow
- [ ] Human signer completes the provider flow

## M5 — Verified completion and submission evidence

- [x] Raw-body webhook verification and event replay defense
- [x] Monotonic event processing and provider correlation
- [x] Executed PDF retrieval, validation, storage and digest implementation
- [x] End-to-end fixture browser journey and negative demo
- [x] Reproducible setup and architecture documentation
- [ ] Recorded demo video
- [x] Concrete procurement buyer story with measurable evaluation targets
