# Quickstart: Validate the Secure Signing Journey

This guide validates the planned behavior. Commands that require credentials are
explicitly separated. Never use production documents or credentials in fixtures.

## Prerequisites

- Node.js and pnpm versions declared by the repository
- PostgreSQL database dedicated to integration tests
- Docker-compatible container runtime for the PDF parser sandbox
- For the bounded live scenario only: Foxit PDF and eSign sandbox credentials,
  webhook secret, public HTTPS callback, and a consenting test signer

## 1. Clean local quality gate

```bash
pnpm install --frozen-lockfile
pnpm check
TEST_DATABASE_URL=postgresql://... pnpm test:integration
```

Expected: two consecutive clean runs pass without modifying tracked files.

## 2. Fixture-first primary journey

```bash
pnpm test:harness
pnpm test:browser
```

Expected: a procurement intent becomes a structured agreement and review snapshot;
no provider network call occurs and the timeline labels the evidence as fixture data.

## 3. Exact approval and visible mutation

```bash
pnpm test:harness
pnpm test:attack
```

Expected: mutations to document bytes, recipients, fields, findings, and intent each
invalidate approval and block dispatch. Restoring values still requires new approval.

## 4. Tenant, budget, and duplicate isolation

```bash
TEST_DATABASE_URL=postgresql://... pnpm test:integration
```

Expected: cross-tenant reads return indistinguishable denial; twenty concurrent
identical operations reserve one budget unit and produce one operation row.

## 5. Parser and provider boundary attacks

```bash
pnpm test:attack
pnpm test:contract
```

Expected: malformed and resource-heavy PDFs, excessive or hanging child processes,
forged/replayed webhooks, and ambiguous dispatch responses all fail closed.

The boundary suite MUST exercise 64 KiB JSON, 1 MiB webhook, 10 MiB PDF, 256 KiB
parser output, 1 MiB child output, 10-second parser, 90-second MCP, five-second kill,
120-second lease, two-retry, and 24-hour secret-overlap limits at exact boundaries.

## 6. Bounded live Foxit journey

This step consumes provider resources and is not part of routine validation. An
authorized operator must enable a one-operation budget and explicitly confirm the
test tenant, recipient, artifact digest, and provider account immediately before run.

```bash
pnpm operator:live-proof -- \
  --workflow <uuid> \
  --review-digest <64-hex-digest> \
  --artifact-sha256 <64-hex-digest> \
  --recipient <consenting-sandbox-address> \
  --budget 1 \
  --authorization-id <fresh-private-authorization-id>
```

This command processes only an already-pending dispatch for the named workflow. The
dispatcher must first enqueue that exact approved review through the authenticated UI
while `SIGNLATCH_ESIGN_ENQUEUE_ENABLED=true`. Worker execution additionally requires
`SIGNLATCH_ESIGN_WORKER_ENABLED=true` and an exact
`SIGNLATCH_LIVE_PROOF_AUTHORIZATION_ID` match. These gates must be removed immediately
after the one bounded attempt.

Expected: one Foxit eSign envelope is sent to the consenting signer. After signing and
receiving the provider's authenticated completed event, retrieve and independently hash
the executed document, then derive private evidence from correlated database state:

```bash
SIGNLATCH_COMPLETION_WORKER_ENABLED=true pnpm completion:run -- <provider-envelope-id>
SIGNLATCH_COMPLETION_EVIDENCE_ENABLED=true pnpm completion:evidence -- <workflow-uuid>
```

Both commands require `DATABASE_URL`, the eSign read credentials, an absolute private
`SIGNLATCH_ARTIFACT_ROOT`, and an absolute `SIGNLATCH_PRIVATE_EVIDENCE_ROOT`. The
completion evidence command refuses operator-supplied hashes and writes a new private
file with exclusive-create permissions.

## 7. Evidence and public claim verification

```bash
pnpm evidence:verify
pnpm evidence:privacy-scan
```

Expected: every claim has a dated evidence record and byte digest; no credential,
private document content, raw provider payload, or unnecessary personal data appears.
Moving staged evidence into a public path or publishing media remains a separate human
authorization step.

## 8. Recovery and accessibility gates

```bash
pnpm test:browser
TEST_DATABASE_URL=postgresql://... pnpm operations:restore-probe
pnpm evidence:links
```

Expected: WCAG 2.2 AA review and ceremony requirements pass at keyboard, screen reader,
reduced-motion, and 320-pixel viewport gates; the recovery probe demonstrates RPO at
or below five minutes and RTO at or below one hour; evidence has zero broken links.
