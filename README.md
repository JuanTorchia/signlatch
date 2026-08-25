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
foundation includes the deterministic approval envelope, an executable attack
harness and a Postgres workflow store tested against a real database. Production
database provisioning, Foxit credentials, MCP orchestration and eSign dispatch
are not complete and are never represented as complete.

Current milestone: **M2 — durable workflow core**. The Postgres state machine,
transactional dispatch claim, outbox, reconciliation path and audit hash chain
are implemented and integration-tested. Production database provisioning and the
Foxit adapter remain pending.

See [docs/roadmap.md](docs/roadmap.md) for milestone gates and evidence required
before each integration is enabled.

Postgres integration tests require an isolated test database:

```bash
TEST_DATABASE_URL=postgresql://... pnpm test:integration
```

The test migration truncates its configured database. Never point
`TEST_DATABASE_URL` at development or production data.

## Security

- Credentials remain server-side and are never committed.
- A generated document is not authorization to send it.
- Approval will bind to an artifact hash and exact recipient set.
- Webhook authenticity will be verified before state changes.
- The product provides workflow risk signals, not legal advice.

Security findings are welcome through the process described in
[SECURITY.md](SECURITY.md). Please do not include documents, credentials or
personal data in public issues.
