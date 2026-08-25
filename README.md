# SignLatch

Human authority for agentic documents.

SignLatch is a public hackathon project for the Foxit Software challenge **Your Agent Shouldn't Sign That** at DevNetwork [API + Cloud + AI] Hackathon 2026. It places a visible, auditable approval checkpoint between reversible AI document preparation and the irreversible act of sending a document for electronic signature.

## Architecture

```text
Plain-language request → Agent → Foxit PDF MCP → Policy engine
→ Human approval latch → Foxit eSign → Verified audit trail
```

See [docs/architecture.md](docs/architecture.md) for trust boundaries and the planned implementation.

## Development

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

## Status

The public foundation and architecture are in place. Foxit credentials, MCP orchestration, policy evaluation, approval persistence and eSign dispatch are the next milestones.

## Security

- Credentials remain server-side and are never committed.
- A generated document is not authorization to send it.
- Approval will bind to an artifact hash and exact recipient set.
- Webhook authenticity will be verified before state changes.
- The product provides workflow risk signals, not legal advice.
