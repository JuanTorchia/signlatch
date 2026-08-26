# Feature Specification: Secure Signing Journey

**Feature Branch**: `001-secure-signing-journey`

**Created**: 2026-08-25

**Status**: Ready for planning

**Input**: User description: "Turn SignLatch into a competition-winning, public,
agentic document workflow that preserves exact human authority through Foxit PDF
preparation, Foxit eSign dispatch, and verified completion."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operate a Safe Public Workspace (Priority: P1)

An authenticated operator can create and revisit document workflows in an owned
workspace while anonymous visitors can inspect a read-only showcase without
consuming provider credits or accessing private artifacts.

**Why this priority**: Every later story depends on a public runtime that cannot be
abused to spend credits, leak documents, or confuse one user's work with another's.

**Independent Test**: Two users and one anonymous visitor attempt the same workflow;
only the owner can access private artifacts or start a bounded provider operation,
and repeated requests produce one charged operation.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor, **When** the visitor opens the showcase, **Then**
   sanitized example evidence is visible and every credit-consuming control is inert.
2. **Given** two authenticated users, **When** one requests the other's artifact,
   **Then** access is denied without revealing whether the artifact exists.
3. **Given** an authorized operator retries an identical preparation request,
   **When** the first request is active or complete, **Then** no duplicate charge is
   created and the same durable operation result is returned.

---

### User Story 2 - Turn Intent into a Reviewable Agreement (Priority: P2)

An operator describes a supplier agreement in plain language. The agent produces a
structured agreement, uses approved reversible document operations to render it, and
presents the exact artifact, recipients, fields, findings, digest, provenance, and
changes for human review.

**Why this priority**: This makes the agent materially useful while keeping generation
separate from authority.

**Independent Test**: Starting with only a procurement request, the operator receives
a structurally valid, downloadable agreement and a complete review surface without
any signing invitation being sent.

**Acceptance Scenarios**:

1. **Given** a complete supplier-agreement intent, **When** preparation finishes,
   **Then** all required agreement facts are represented in structured form and the
   rendered artifact matches them.
2. **Given** missing or conflicting material terms, **When** preparation is requested,
   **Then** the workflow asks for or flags the unresolved facts and remains unsendable.
3. **Given** a prepared artifact, **When** it is opened for review, **Then** its current
   digest, recipients, fields, findings, provenance, and version differences are shown.

---

### User Story 3 - Prove the Human Approval Latch (Priority: P3)

A distinct human approver authorizes the exact reviewed values. The demonstration can
then mutate an artifact, recipient, field, or finding and visibly prove that approval
is invalidated and dispatch fails closed until the human reviews and approves again.

**Why this priority**: This is SignLatch's central product claim and the hackathon's
most memorable security demonstration.

**Independent Test**: Approve a prepared agreement, alter each bound category in turn,
and verify that every alteration blocks dispatch with an intelligible explanation.

**Acceptance Scenarios**:

1. **Given** an authorized approver and a complete review, **When** approval is granted,
   **Then** it binds the exact artifact, recipients, fields, findings, and intent.
2. **Given** a valid approval, **When** any bound value changes, **Then** approval becomes
   invalid before dispatch and the changed values are highlighted.
3. **Given** an invalidated approval, **When** the original values are restored, **Then**
   the workflow still requires a new explicit approval rather than reviving the old one.

---

### User Story 4 - Dispatch Through Foxit eSign (Priority: P4)

An authorized dispatcher can send only a currently approved agreement through Foxit
eSign, see a provider-correlated result, and safely retry without sending duplicates.

**Why this priority**: It closes the gap between a strong local security concept and a
real end-to-end Foxit product integration.

**Independent Test**: Dispatch one approved sandbox agreement, retry the request, and
verify that exactly one provider envelope exists and every local event references it.

**Acceptance Scenarios**:

1. **Given** a current exact approval, **When** the dispatcher sends the agreement,
   **Then** one Foxit eSign envelope is created with the approved recipients and fields.
2. **Given** missing, expired, invalidated, or unauthorized approval, **When** dispatch
   is attempted, **Then** no provider request occurs and a denial event is recorded.
3. **Given** an ambiguous provider timeout, **When** dispatch is retried, **Then** the
   system reconciles by idempotency and provider correlation before creating anything.

---

### User Story 5 - Verify Human Completion (Priority: P5)

After the invited signer acts, the operator sees authenticated provider events, the
executed document's independently computed digest, and a coherent audit timeline from
intent through completion.

**Why this priority**: Completion evidence turns “we called an API” into a defensible
end-to-end result.

**Independent Test**: Complete a sandbox signing ceremony and reproduce the timeline
and executed-document digest from sanitized stored evidence.

**Acceptance Scenarios**:

1. **Given** a valid provider event, **When** it is received more than once, **Then** it
   changes workflow state exactly once and duplicate receipt remains auditable.
2. **Given** a forged, stale, or uncorrelated event, **When** it is received, **Then** it
   cannot change workflow state and the rejection is recorded safely.
3. **Given** provider-confirmed completion, **When** the executed document is retrieved,
   **Then** its bytes are structurally validated, hashed, linked to the envelope, and
   exposed only to authorized users.

---

### User Story 6 - Reproduce the Winning Demonstration (Priority: P6)

A judge or developer can follow a concise validation guide and understand what is
real, what is simulated, which Foxit products are used, which attacks were blocked,
and which evidence proves each claim.

**Why this priority**: A technically correct project still loses if its value and proof
cannot be understood quickly.

**Independent Test**: A reviewer unfamiliar with the code completes the scripted demo
and maps every published claim to evidence in under ten minutes.

**Acceptance Scenarios**:

1. **Given** the public showcase, **When** a judge follows the primary narrative,
   **Then** preparation, approval, mutation denial, real dispatch, and completion are
   clearly distinguished and ordered.
2. **Given** public documentation or media, **When** a claim mentions cost, provider
   behavior, immutability, or completion, **Then** it is scoped and linked to dated,
   sanitized evidence.

### Edge Cases

- The request body omits, lies about, or exceeds its declared size.
- The PDF is truncated, encrypted, polyglot, decompression-heavy, or structurally invalid.
- The provider process hangs, writes excessive output, ignores cancellation, or exits late.
- Two instances race for the same budget, lease, approval, or dispatch idempotency key.
- Artifact bytes change after preparation or immediately before download or dispatch.
- A recipient differs only by case, Unicode form, ordering, or invisible characters.
- An approver loses permission after review but before approval or dispatch.
- A webhook arrives before the dispatch response, out of order, stale, duplicated, or forged.
- Provider cleanup fails after local completion or cancellation.
- A public evidence record accidentally contains a credential, document text, or personal data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST authenticate operators, approvers, and dispatchers and
  enforce tenant ownership for every private workflow, artifact, and action.
- **FR-002**: Anonymous users MUST be limited to sanitized read-only showcase data and
  MUST NOT trigger external effects.
- **FR-003**: The system MUST durably enforce provider budgets, concurrency leases,
  rate limits, and idempotency across multiple runtime instances.
- **FR-004**: The system MUST limit complete request bodies independently of client
  headers and reject oversized or malformed inputs before provider work begins.
- **FR-005**: The agent MUST convert plain-language procurement intent into a validated
  structured agreement and explicitly surface missing or conflicting material facts.
- **FR-006**: Document preparation MUST use only approved reversible Foxit operations
  and MUST record sanitized tool provenance and dated cost evidence.
- **FR-007**: Every accepted PDF MUST pass bounded structural validation and receive a
  digest computed from the stored bytes; reported provider size MUST be compared with
  actual size.
- **FR-008**: The review experience MUST show the exact artifact, structured facts,
  recipients, signing fields, policy findings, provenance, digest, and version diff.
- **FR-009**: Approval MUST require a distinct authorized human and bind the exact
  canonical artifact digest, recipients, fields, findings, and dispatch intent.
- **FR-010**: Any change to a bound value MUST invalidate approval, remain auditable,
  and require a new review and approval even if the prior values are restored.
- **FR-011**: The product MUST provide a visible mutation demonstration covering the
  artifact and at least one non-artifact bound value.
- **FR-012**: Only the dispatcher role MUST be able to request Foxit eSign dispatch,
  and dispatch MUST revalidate ownership, permissions, approval, digest, and budget.
- **FR-013**: Foxit eSign dispatch MUST be idempotent and MUST correlate local workflow,
  provider envelope, provider document, recipients, and every related event.
- **FR-014**: Ambiguous dispatch outcomes MUST be reconciled with provider state before
  a retry can create a new envelope.
- **FR-015**: Provider events MUST be authenticated, replay-resistant, deduplicated,
  order-tolerant, and unable to mutate unrelated workflows.
- **FR-016**: Provider-confirmed completion MUST retrieve the executed document,
  validate and hash its actual bytes, and preserve a sanitized completion record.
- **FR-017**: Artifact download and serving MUST recheck ownership and byte integrity;
  a mismatch MUST quarantine the artifact and block further action.
- **FR-018**: Provider subprocesses MUST use pinned execution context, bounded output,
  hard timeouts, and cancellation that terminates the full child process tree.
- **FR-019**: Remote and local documents MUST follow explicit retention, deletion, and
  failure-reconciliation policies without rewriting historical evidence.
- **FR-020**: Every security-relevant transition MUST append a tamper-evident audit
  event with actor, role, time, correlation, reason, and before/after state references.
- **FR-021**: Logs and public evidence MUST exclude secrets, private document content,
  unnecessary personal data, and unsanitized provider payloads.
- **FR-022**: The system MUST offer a reproducible demo mode whose fixtures consume no
  credits and a separately authorized bounded live mode for real provider evidence.
- **FR-023**: Public claims MUST distinguish implemented, demonstrated, simulated, and
  planned behavior and MUST scope legal, immutability, cost, and provider claims.
- **FR-024**: Every user story MUST include automated positive and negative tests plus
  reproducible evidence for external boundaries it exercises.

### Role and Ceremony Requirements

| Actor | Permitted | Prohibited |
|---|---|---|
| Anonymous visitor | Read sanitized fixture showcase | Read private state; prepare; approve; mutate; dispatch |
| Operator | Own workflows; prepare; correct facts; request demo mutations | Approve; dispatch; configure provider credentials |
| Agent service | Structure intent; propose recipients and fields; prepare through allowlisted reversible tools | Authenticate as a human; approve; dispatch; read eSign credentials |
| Approver | Review and approve an exact current snapshot | Modify the snapshot during approval; dispatch in the approval request |
| Dispatcher | Revalidate and consume an exact approval; request or reconcile dispatch | Create or broaden approval; alter bound values |
| Auditor | Read authorized workflow, audit, and evidence summaries | Prepare; mutate; approve; dispatch |
| Human signer | Act only in the provider signing ceremony | Operate or approve the SignLatch workflow by virtue of being a signer |

- **RR-001**: Membership and capability MUST be rechecked at review, approval,
  dispatch, artifact access, and provider-event processing time.
- **RR-002**: One human MAY hold approver and dispatcher memberships only in the
  sandbox maintainer tenant, but approval and dispatch MUST be separate requests,
  separate capability activations, and separate audit events. Dispatch MUST require
  reauthentication no older than five minutes and MUST show that it is not approval.
- **RR-003**: The approval ceremony MUST show the complete exact snapshot, require an
  unchecked acknowledgement stating that any change needs new approval, require the
  approver to type `APPROVE`, and submit only the displayed snapshot digest.
- **RR-004**: Dispatch MUST occur on a separate screen after approval, show provider,
  account, recipients, artifact digest, and remaining live grant, require the
  dispatcher to type `SEND`, and never share a submit control with approval.
- **RR-005**: The visible mutation demonstration MUST cover document bytes and a
  recipient. It MUST identify the changed category and old/new canonical value,
  explain that the old approval is permanently invalid, and direct the user to review.

### Operational Limits and Recovery Requirements

- **OR-001**: JSON request bodies MUST be limited to 64 KiB, webhook raw bodies to
  1 MiB, prepared or executed PDFs to 10 MiB, parser output to 256 KiB, and combined
  provider child stdout/stderr to 1 MiB. Limits apply while streaming, regardless of
  client headers.
- **OR-002**: PDF parsing MUST run for at most 10 seconds with 256 MiB memory and no
  network or writable host filesystem. Foxit MCP preparation MUST run for at most
  90 seconds and cancellation MUST terminate the process tree within five seconds.
- **OR-003**: Each tenant receives five live preparation credits per UTC day. Credits
  do not roll over. A live eSign dispatch requires a maintainer-issued one-operation
  grant that expires after 15 minutes and has no automatic reset or user override.
- **OR-004**: Reservations MAY be released only after the adapter proves no provider
  request was sent. Ambiguous outcomes retain the reservation and enter reconciliation.
- **OR-005**: Token acquisition and proven pre-send transient failures allow at most
  two retries with bounded jittered backoff. Validation, authorization, budget, and
  permanent provider failures receive no retry. Ambiguous sends receive no blind retry.
- **OR-006**: Worker leases last 120 seconds and renew every 30 seconds. Expiry moves
  the operation to reconciliation; generation fencing rejects late completion. The
  dispatcher worker owns send reconciliation and the completion worker owns document
  retrieval reconciliation.
- **OR-007**: PostgreSQL backup recovery point MUST be five minutes or less and full
  service recovery time MUST be one hour or less. Artifact backups MUST use matching
  retention and daily restore probes. A worker with no heartbeat for five minutes
  MUST alert and MUST NOT cause synchronous fallback dispatch.

### Provider Process and eSign Requirements

- **PR-001**: The provider-process contract MUST pin the executable digest, Python
  environment, module source root, absolute working directory, allowlisted environment
  variables, arguments, tool catalog, output limits, timeout, and process-tree kill.
- **PR-002**: Correlation MUST store the local workflow and dispatch IDs, Foxit account
  and region, folder/envelope ID, every document ID, every party ID, provider event
  identifier when present plus raw-body digest, activity-history digest, download
  operation identifier when present, and executed artifact digest.
- **PR-003**: OAuth invalid credentials fail permanently; rate limits and server errors
  retry only when known pre-send; provider validation fails permanently; network
  timeout or unknown response enters reconciliation before any new create request.
- **PR-004**: Webhook HMAC verification MUST occur over the unparsed bytes before JSON
  parsing. The query signature MUST be canonical base64, at most 256 characters, and
  compared in constant time. During rotation, current and previous secrets MAY verify
  for 24 hours, with the matched secret version recorded but never its value.
- **PR-005**: Duplicate valid events are acknowledged without a second transition;
  stale or out-of-order events add evidence without state regression; early correlated
  events are durably held; uncorrelated or malformed events are rejected; cancelled is
  terminal; completed is nonterminal evidence; executed triggers final retrieval.

### Review Experience and Accessibility Requirements

- **UXR-001**: The review page MUST prioritize, in order: blocked/ready status,
  material diff, document preview, recipients and fields, policy findings, digest,
  and provenance. Every digest and provider term MUST have a plain-language explanation.
- **UXR-002**: Every action MUST be keyboard operable with visible focus, programmatic
  name and error association, logical heading order, and screen-reader announcement
  for loading, blocking, mutation, approval, dispatch, and completion states.
- **UXR-003**: Text and controls MUST meet WCAG 2.2 AA contrast; information MUST NOT
  depend on color alone; reduced-motion preferences MUST disable nonessential motion.
- **UXR-004**: Review and ceremonies MUST remain usable at 320 CSS pixels without
  horizontal page scrolling. Loading, empty, timeout, denied, stale, quarantined,
  reconcile, and provider-error states MUST each specify recovery or safe termination.

### Evidence, Retention, and Release Requirements

- **ER-001**: Each public claim MUST use one status (`implemented`, `live-demonstrated`,
  `fixture-demonstrated`, or `planned`) and map to a dated evidence record containing
  source operation, sanitizer version, artifact digest, and reproduction command.
- **ER-002**: Cost claims require a dated account/provider observation; provider
  behavior claims require an official source or captured contract result; security
  claims require a negative test; completion claims require authenticated event,
  provider correlation, executed-byte digest, and activity-history digest.
- **ER-003**: Draft and prepared private PDFs expire after seven days; executed private
  PDFs and private provider responses expire after 30 days; raw webhook bodies and
  diagnostic child output expire after 24 hours; sanitized public fixtures and claim
  manifests remain until superseded but historical digests are retained.
- **ER-004**: Provider-side draft cleanup begins within 24 hours after cancellation,
  failure, or local expiry and retries for seven days. Failure creates an operator
  alert and audit event; it MUST NOT be represented as deletion.
- **ER-005**: Final release requires two clean-checkout quality runs, integration and
  attack gates, link validation with zero broken internal or public evidence links,
  a manifest in which every public file and claim has a matching digest, and privacy
  scans with zero secret, private-PDF-text, raw-payload, or unnecessary-PII findings.

### Key Entities

- **Tenant**: Ownership boundary containing memberships, roles, budgets, and workflows.
- **Principal**: Authenticated human or service identity with one or more scoped roles.
- **Agreement Intent**: Original request plus structured procurement facts and unresolved items.
- **Document Version**: Immutable stored bytes, digest, structural-validation result, and provenance.
- **Recipient Set**: Canonical ordered signing parties and their exact delivery identities.
- **Signing Field Set**: Canonical field types, assignees, pages, and coordinates.
- **Policy Finding Set**: Versioned findings, severity, rationale, and acknowledgement state.
- **Approval Envelope**: One-time human authorization over all exact bound values.
- **Dispatch Attempt**: Idempotent request, approval reference, reconciliation state, and provider correlation.
- **Provider Envelope**: Foxit eSign identifiers and lifecycle state associated with one dispatch.
- **Audit Event**: Append-only transition record with actor, correlation, and integrity linkage.
- **Evidence Record**: Sanitized proof that supports one public technical or provider claim.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In an isolation test with two tenants, 100% of cross-tenant private
  workflow and artifact requests are denied without existence disclosure.
- **SC-002**: Twenty concurrent identical preparation or dispatch requests produce
  exactly one billable provider operation and one durable result.
- **SC-003**: 100% of mutations across artifact, recipient, field, finding, and intent
  categories invalidate approval before any provider dispatch.
- **SC-004**: A first-time operator can move a complete procurement intent to the
  exact review checkpoint in under three minutes without sending a signature request.
- **SC-005**: The scripted live path creates exactly one Foxit eSign envelope, records
  authenticated completion, and independently hashes the executed document.
- **SC-006**: Every intentionally malformed PDF, forged event, oversized request,
  unauthorized action, timeout, and duplicate request in the attack suite fails closed.
- **SC-007**: A reviewer can reproduce the primary journey and map every public claim
  to sanitized evidence in under ten minutes.
- **SC-008**: Automated secret and privacy scans find zero credentials, private
  document contents, or unnecessary personal data in public artifacts and logs.
- **SC-009**: All project quality, integration, contract, and attack gates pass twice
  from a clean checkout with no undocumented manual correction.

## Assumptions

- The first production use case is a sandbox supplier agreement, not general-purpose
  legal-document automation or legal advice.
- GitHub-based authentication is acceptable for the public developer showcase;
  organizations requiring enterprise identity are outside this competition release.
- Foxit sandbox credentials and a consenting test signer are available for one bounded
  live proof; fixtures cover routine development and judge replay without spending credits.
- The public deployment supports a small hackathon audience, while correctness under
  concurrent instances is required even at low traffic.
- Raw customer documents remain private; only deliberately sanitized fixtures and
  evidence are public.
- Media, posts, and submission copy remain drafts until separately approved for publication.
- The Foxit account owner configures webhook channels and secret rotation, owns sandbox
  credentials, verifies executed-document download permission, and records consenting
  signer approval before a live grant is issued.

## Out of Scope

- Legal advice, clause correctness guarantees, identity proofing, notarization, payments,
  multi-provider signing, arbitrary contract families, and enterprise compliance certification.
- Autonomous approval or signing by an agent.
- Public self-service access to credit-consuming Foxit operations.
