# SignLatch

Human authority for agentic documents.

SignLatch is a public hackathon project for the Foxit Software challenge **Your Agent Shouldn't Sign That** at DevNetwork [API + Cloud + AI] Hackathon 2026. It places a visible, auditable approval checkpoint between reversible AI document preparation and the irreversible act of sending a document for electronic signature.

## Architecture

```text
Plain-language request → Agent → Foxit PDF MCP → Policy engine
→ Human approval latch → Foxit eSign → Verified audit trail
```

See [docs/architecture.md](docs/architecture.md) for trust boundaries and the
implementation sequence. Architectural decisions are recorded in
[docs/decisions](docs/decisions), and the public security model lives in
[docs/threat-model.md](docs/threat-model.md).

## Development

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

Real PDF preparation uses Foxit's official Python MCP server. Follow the
[Foxit MCP developer setup](docs/foxit-mcp-setup.md) to obtain credentials,
install the server and configure local secrets.

Set `SIGNLATCH_DEMO_ENABLED=true` only in a trusted local environment to expose
the credit-consuming preparation route. The connected dashboard showed one credit for
the verified conversion on 2026-08-25; pricing and account allowances can change and
must be rechecked before another live run. eSign enqueue remains independently disabled.

Run the same quality gate used by CI:

```bash
pnpm check
```

Run the human-authority attack harness directly:

```bash
pnpm test:harness
```

## Public build status

This repository is the public system of record from day zero. The implemented
foundation includes exact approval v2, a five-category attack harness, durable review
and dispatch stores race-tested against PostgreSQL, raw-body webhook verification, a
real Foxit MCP preparation run, and one bounded Foxit eSign journey completed by a
consenting human. SignLatch reconciled eight authenticated provider events, downloaded
and structurally validated the executed PDF, and stored its 60,071 bytes under SHA-256
`058c3e619e459d016ac779ba07bab0dca4891e70a49c4c0365e00fc526175e79` before
marking the workflow complete. Sanitized proof is in
[`evidence/live-completion-2026-08-28.json`](evidence/live-completion-2026-08-28.json).

Current milestone: **M5 — live provider closure demonstrated**. The deployed public
showcase at <https://signlatch.juanchi.dev/> explains both the safe fixture and the live
completion proof. Persistent dispatch and completion workers remain disabled by default;
the completed journey does not authorize another provider operation.

See [docs/roadmap.md](docs/roadmap.md) for milestone gates and evidence required
before each integration is enabled.

The initial procurement scenario and its measurable value hypothesis are documented in
[docs/procurement-use-case.md](docs/procurement-use-case.md). Values there are evaluation
targets, not claimed customer outcomes.

Postgres integration tests require an isolated test database:

```bash
TEST_DATABASE_URL=postgresql://... pnpm test:integration
```

The test migration truncates its configured database. Never point
`TEST_DATABASE_URL` at development or production data.

## Security

- Credentials remain server-side and are never committed.
- A generated document is not authorization to send it.
- Approval binds the exact review digest, artifact, recipients, fields, findings, intent, and provenance.
- Webhook authenticity is verified over bounded raw bytes before parsing or state changes.
- “Tamper-evident” refers to SignLatch's hash-linked application audit boundary; it is not an external timestamp or immutable-ledger claim.
- The product provides workflow risk signals, not legal advice.

Security findings are welcome through the process described in
[SECURITY.md](SECURITY.md). Please do not include documents, credentials or
personal data in public issues.
