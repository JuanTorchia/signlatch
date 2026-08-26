# Threat model

## Protected assets

- Human signing authority and approver identity
- Exact document bytes reviewed by the approver
- Recipient identities, roles, order and authentication methods
- Foxit eSign credentials and provider account identity
- Executed documents, signatures, personal data and audit events

## Trust boundaries

The prompt, uploaded PDF, OCR output and document metadata are untrusted. The
agent and Foxit MCP preparation layer can propose work but cannot authorize
dispatch. The approval service authenticates human intent. The eSign dispatcher
is server-only and has the minimum credential scope. Provider webhooks are
untrusted until their raw request signature and freshness are verified.

## Priority threats

| Threat | Required control | Current state |
| --- | --- | --- |
| Artifact mutation after review | Immutable bytes and pre-dispatch rehash | Implemented and integration-tested |
| Recipient or role substitution | Canonical bound recipient list | Implemented and fixture-demonstrated |
| Approval replay or double send | Atomic consumption, outbox and idempotency | Implemented and race-tested |
| Prompt injection from PDF content | Sandboxed parsing and data/instruction separation | Implemented with hostile fixtures |
| Agent access to eSign credentials | Separate server-only adapter outside agent tools | Implemented; live credentials disabled |
| Forged, replayed, stale, or future-dated webhook | Raw-body HMAC, rotation, bounded event time and event replay store | Implemented; live provider proof pending |
| Audit tampering | Hash-linked event chain | Implemented and mutation-tested |
| Cross-tenant authorization | Tenant-bound approval and current membership checks | Implemented and integration-tested |

## Security claim policy

Documentation distinguishes implemented controls from planned controls. A test
harness proves deterministic semantics, not production atomicity, legal
sufficiency or provider security. Risk findings support human review and are not
legal advice.
