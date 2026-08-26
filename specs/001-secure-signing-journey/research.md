# Research: Secure Signing Journey

## Decision 1: Keep one application and isolate authority in capabilities

**Decision**: Extend the existing Next.js application with server-only capability
boundaries for prepare, approve, dispatch, and provider-event processing. Keep Foxit
eSign credentials solely inside the dispatch adapter.

**Rationale**: Process count is not an authority boundary. Explicit session roles,
server-only imports, adapter interfaces, and integration tests provide a smaller and
more reviewable competition architecture while preserving identity separation.

**Alternatives considered**: Separate microservices were rejected for the initial
release because they add deployment and correlation failure modes without changing
the exact approval invariant. Putting eSign in the MCP tool registry was rejected
because the agent would inherit irreversible authority.

## Decision 2: GitHub OAuth session for the public developer showcase

**Decision**: Use a server-side GitHub OAuth session, explicit tenant membership, and
capability checks. Seed the maintainer as approver and dispatcher. Public pages use a
synthetic showcase tenant that has no provider capabilities.

**Rationale**: The audience already has developer identities, session revocation is
available, and the choice avoids maintaining password credentials. Authorization is
still project-owned and is not inferred from GitHub profile data after membership is
created.

**Alternatives considered**: Magic links add email delivery and abuse concerns;
anonymous demo access cannot safely own artifacts or credits; enterprise SSO is out
of scope.

## Decision 3: PostgreSQL owns every external-effect decision

**Decision**: Model budgets, idempotency keys, concurrency leases, approval
consumption, outbox state, and webhook deduplication as PostgreSQL rows updated in
transactions. Use row locking, unique constraints, and lease-generation fencing.

**Rationale**: The existing durable workflow core already proves the outbox pattern.
Database authority survives restarts and multiple app instances, unlike a process
boolean or in-memory counter.

**Alternatives considered**: Redis would introduce a second state authority; an
in-memory semaphore is unsafe across instances; provider-only idempotency does not
protect local budget or approval consumption.

## Decision 4: Bounded private artifact storage with re-verification

**Decision**: Store PDF bytes under their SHA-256 content address on a private
persistent volume. Stream uploads and downloads through size limits, run a sandboxed
structural parser, and recompute the digest before review, download, approval, and
dispatch. Quarantine mismatches.

**Rationale**: The current store is a useful base, but lexical `%PDF` checks cannot
establish structural validity and a stored filename does not prove current bytes.

**Alternatives considered**: Public object URLs conflict with private evidence;
database byte storage complicates large streaming; trusting provider metadata leaves
the most important evidence unverified.

## Decision 5: Structured agreement is the agent boundary

**Decision**: The agent produces a schema-validated supplier-agreement intent with
parties, commercial terms, required clauses, signers, unresolved facts, and source
citations. Deterministic code converts that structure into the render input and policy
findings.

**Rationale**: A plain text wrapper does not demonstrate agency and makes review and
diffing ambiguous. Structured facts give the approver a stable, explainable surface.

**Alternatives considered**: Free-form model output was rejected as untestable;
general contract generation was rejected as too broad for the competition slice.

## Decision 6: Direct Foxit eSign REST adapter and executed-event completion

**Decision**: Obtain OAuth 2.0 client-credentials tokens server-side, create a Foxit
eSign envelope from the approved PDF, and persist folder/envelope identifiers. Treat
`folder_executed` as the terminal evidence trigger, then retrieve and independently
hash the executed document. Verify webhook HMAC-SHA-256 over the raw request body
using constant-time comparison before parsing.

**Rationale**: Foxit's current official documentation states that eSign uses OAuth
2.0, envelope creation is `POST /esign/api/v1/folders/createfolder`, webhooks include
an HMAC-SHA-256 base64 signature in the `signature` query parameter, and
`folder_executed` occurs after digital-signature finalization. The official reference
also exposes envelope detail, activity history, and download operations.

**Alternatives considered**: Polling alone loses real-time and authenticity evidence;
`folder_completed` occurs before the executed lifecycle point; embedded signing is
optional and not required for the first consenting test signer.

**Primary sources verified 2026-08-25**:

- [Foxit API documentation](https://docs.developer-api.foxit.com/)
- [Foxit eSign API reference](https://app.developer-api.foxit.com/reference)
- [Foxit end-to-end eSignature guide](https://developer-api.foxit.com/developer-blogs/api-guides-tutorials/esignature-api-guide-add-signing-app/)

## Decision 7: Fixture-first demo and bounded live mode

**Decision**: The public journey replays sanitized, cryptographically checked fixtures.
Only an authenticated dispatcher can enable a single-use live run with a durable
operation budget and explicit confirmation.

**Rationale**: Judges can explore safely and repeatedly while one dated live capture
proves the real integration. This prevents crawlers or abuse from consuming credits.

**Alternatives considered**: A fully live public demo is unnecessarily expensive and
risky; screenshots alone do not prove behavior.

## Decision 8: Container deployment on the existing host

**Decision**: Deploy one Linux container with a pinned Node and Python environment,
PostgreSQL, a private persistent artifact volume, public HTTPS, and a separately
scheduled worker entry point. Pin the MCP executable, module source, and working
directory in the image.

**Rationale**: The official Foxit MCP server is a Python stdio child, so a container
matches the verified local architecture and makes the execution context reproducible.

**Alternatives considered**: A serverless-only runtime is a poor fit for a managed
child process and persistent private volume; a new cloud platform adds contest risk.
