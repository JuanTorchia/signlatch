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
and dispatch stores race-tested against PostgreSQL, raw-body webhook verification, and
a real Foxit MCP preparation run with sanitized evidence. The eSign client and completion
path are fixture-tested but no live eSign delivery is claimed. A fixture-first revision is
deployed at <https://signlatch.juanchi.dev/>; deploying a newer revision and enabling any
provider effect remain separate human gates.

Current milestone: **M5 — provider closure pending one authorized sandbox journey**.
The exact human latch, controlled dispatch, authenticated event lifecycle, evidence
manifest, privacy scan, and judge-visible fixture journey are implemented. Live eSign
remains disabled by default and cannot be inferred from fixture results.

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
