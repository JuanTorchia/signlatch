# Tasks: Secure Signing Journey

**Input**: Design documents from `specs/001-secure-signing-journey/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required by FR-024 and Constitution Principle V. Write each listed test first and observe failure before implementation.

**Organization**: Tasks are grouped by independently testable user story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make the target runtime, test layers, and operator boundaries explicit.

- [X] T001 Add contract, attack, and browser test scripts plus operator script entries to package.json
- [X] T002 [P] Add documented non-secret runtime variables and bounds to .env.example
- [X] T003 [P] Create production and test migration directories with ordering rules in migrations/README.md
- [X] T004 [P] Create provider fixture and malformed-PDF corpus policies in tests/fixtures/README.md
- [X] T005 Add containerized Node, Python MCP, parser sandbox, worker, and healthcheck layout to Dockerfile and compose.yaml
- [X] T006 Pin the Foxit MCP executable, module root, Python environment, and working directory in scripts/verify-runtime-boundary.sh

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared invariants that block every public or provider-facing story.

**Critical**: No user-story work begins until this phase passes its tests.

- [X] T007 [P] Add failing bounded-body contract tests in tests/request-body.test.ts
- [X] T008 [P] Add failing subprocess timeout, cancellation, output-limit, and cwd tests in tests/foxit-mcp-client.test.ts
- [X] T009 [P] Add failing structural PDF corpus and quarantine tests in tests/pdf-validation.test.ts
- [X] T010 [P] Add failing audit hash-chain and redaction tests in tests/audit.test.ts
- [X] T011 Implement streaming request-body limits and typed failures in src/server/http/bounded-body.ts
- [X] T012 Implement pinned child execution, output bounds, and process-tree termination in src/server/foxit/mcp-client.ts
- [X] T013 Implement sandboxed structural PDF validation adapter in src/server/artifacts/pdf-validator.ts
- [X] T014 Recompute artifact size and SHA-256 during store and serve in src/server/artifacts/filesystem-store.ts
- [X] T015 Add quarantine and no-existence-disclosure artifact errors in src/server/artifacts/artifact-errors.ts
- [X] T016 Extend append-only audit events with prior digest, actor role, correlations, and sanitizer in src/core/workflow/audit.ts
- [X] T017 Add production schema for tenants, principals, memberships, budgets, operations, artifacts, and audit events in migrations/0002_secure_foundation.sql
- [X] T018 Add typed transaction repositories for shared foundation entities in src/server/workflow/security-store.ts
- [X] T019 Run pnpm check and the foundational negative suites documented in specs/001-secure-signing-journey/quickstart.md

**Checkpoint**: Child processes, bodies, PDFs, artifacts, audit, and durable authority fail closed.

---

## Phase 3: User Story 1 - Operate a Safe Public Workspace (Priority: P1) — MVP

**Goal**: Deployable authenticated ownership with read-only public fixtures and durable credit protection.

**Independent Test**: Two tenants and an anonymous visitor prove artifact isolation; twenty duplicate requests consume one durable operation.

### Tests for User Story 1

- [X] T020 [P] [US1] Add failing session, CSRF, membership, and capability tests in tests/auth-boundary.test.ts
- [X] T021 [P] [US1] Add failing cross-tenant route and artifact tests in tests-integration/tenant-isolation.test.ts
- [X] T022 [P] [US1] Add failing multi-instance budget, lease, and idempotency races in tests-integration/provider-budget.test.ts
- [X] T023 [P] [US1] Add failing anonymous showcase no-effect browser journey in tests-browser/public-showcase.spec.ts

### Implementation for User Story 1

- [X] T024 [P] [US1] Implement GitHub OAuth session and CSRF primitives in src/server/auth/session.ts
- [X] T025 [P] [US1] Implement tenant membership and capability evaluation in src/server/auth/authorize.ts
- [X] T026 [US1] Add auth callback and sign-out handlers in src/app/api/auth/callback/route.ts and src/app/api/auth/signout/route.ts
- [X] T027 [US1] Implement durable budget reservation, idempotency, leases, and fencing in src/server/workflow/provider-operations.ts
- [X] T028 [US1] Replace process-local preparation concurrency with provider operations in src/app/api/prepare/route.ts
- [X] T029 [US1] Enforce tenant ownership and digest re-verification in src/app/api/artifacts/[sha]/route.ts
- [X] T030 [US1] Add sanitized no-effect showcase fixtures in src/core/evidence/showcase.ts
- [X] T031 [US1] Add authenticated workspace and anonymous showcase states in src/app/page.tsx
- [X] T032 [US1] Provision migration, worker, private volume, HTTPS health checks, backup, and restore instructions in docs/deployment.md
- [X] T033 [US1] Run tenant, budget, browser, and clean production-build gates from specs/001-secure-signing-journey/quickstart.md

**Checkpoint**: Public deployment is safe even before agent generation or eSign exists.

---

## Phase 4: User Story 2 - Turn Intent into a Reviewable Agreement (Priority: P2)

**Goal**: Convert plain procurement intent into structured facts, a valid Foxit PDF, findings, and an exact review snapshot without dispatch authority.

**Independent Test**: A request alone yields a structurally valid agreement and complete review; missing facts block readiness and no eSign call occurs.

### Tests for User Story 2

- [x] T034 [P] [US2] Add failing agreement schema and unresolved-fact tests in tests/agreement-intent.test.ts
- [x] T035 [P] [US2] Add failing deterministic render and policy finding tests in tests/agreement-render.test.ts
- [x] T036 [P] [US2] Add failing preparation size, provenance, retention, and rehash integration tests in tests-integration/foxit-preparation.test.ts
- [x] T037 [P] [US2] Add failing review snapshot and material-diff contract tests in tests/review-snapshot.test.ts

### Implementation for User Story 2

- [x] T038 [P] [US2] Define versioned supplier agreement entities and validation in src/core/agreement/intent.ts
- [x] T039 [P] [US2] Define deterministic procurement policy rules and findings in src/core/agreement/policy.ts
- [x] T040 [US2] Implement constrained intent-to-structure agent boundary in src/server/agent/agreement-agent.ts
- [x] T041 [US2] Implement deterministic agreement render input and source citations in src/core/agreement/render.ts
- [x] T042 [US2] Extend the Foxit preparation adapter with actual-byte size checks and remote cleanup in src/server/foxit/prepare-text-pdf.ts
- [x] T043 [US2] Add agreement intent, document version, provenance, findings, recipients, fields, and review tables in migrations/0003_agreement_review.sql
- [x] T044 [US2] Persist immutable intent and review versions in src/server/workflow/review-store.ts
- [x] T045 [US2] Add owned workflow creation and preparation routes in src/app/api/workflows/route.ts and src/app/api/workflows/[workflowId]/prepare/route.ts
- [x] T046 [US2] Add exact review and diff endpoint in src/app/api/workflows/[workflowId]/review/route.ts
- [x] T047 [US2] Build accessible agreement request and exact review UI in src/app/workflows/[workflowId]/page.tsx
- [x] T048 [US2] Capture sanitized fixture provenance and dated Foxit credit evidence in scripts/capture-preparation-evidence.ts
- [x] T049 [US2] Run the independent intent-to-review journey and prove zero eSign authority using specs/001-secure-signing-journey/quickstart.md

**Checkpoint**: The agent is useful, structured, reversible, and visibly unable to send.

---

## Phase 5: User Story 3 - Prove the Human Approval Latch (Priority: P3)

**Goal**: Bind a distinct human approval to exact current values and visibly demonstrate mutation denial.

**Independent Test**: Every bound category mutation invalidates approval; restoring values does not revive it.

### Tests for User Story 3

- [x] T050 [P] [US3] Add approval-v2 canonical golden vectors and cross-version tests in tests/approval-envelope-v2.test.ts
- [x] T051 [P] [US3] Add failing role separation, stale review, expiry, restore, and replay tests in tests-integration/human-approval.test.ts
- [x] T052 [P] [US3] Extend the attack matrix across artifact, recipient, field, finding, and intent in tests/approval-harness.test.ts
- [x] T053 [P] [US3] Add accessible approval ceremony and visible mutation browser tests in tests-browser/approval-latch.spec.ts

### Implementation for User Story 3

- [x] T054 [P] [US3] Implement the approval-v2 canonical contract in src/core/approval/envelope-v2.ts
- [x] T055 [US3] Add review snapshot, one-way approval, invalidation, and nonce constraints in migrations/0004_exact_approval.sql
- [x] T056 [US3] Implement transactional exact review approval and invalidation in src/server/workflow/approval-store.ts
- [x] T057 [US3] Add approver-only exact-digest endpoint in src/app/api/workflows/[workflowId]/approve/route.ts
- [x] T058 [US3] Add explicit artifact and recipient demo mutations as new versions in src/app/api/workflows/[workflowId]/mutations/route.ts
- [x] T059 [US3] Extend the executable harness with v2 and restoration denial in src/core/approval/harness.ts
- [x] T060 [US3] Build separate review, confirm, invalidated, diff, and reapprove states in src/app/workflows/[workflowId]/approval-panel.tsx
- [x] T061 [US3] Run the complete mutation matrix and archive sanitized denial evidence using scripts/run-approval-harness.ts

**Checkpoint**: The central competition claim is proven before eSign credentials enter the runtime.

---

## Phase 6: User Story 4 - Dispatch Through Foxit eSign (Priority: P4)

**Goal**: Atomically consume exact approval and create one correlated Foxit eSign envelope through an isolated dispatcher.

**Independent Test**: One approved sandbox dispatch creates one envelope; denial and ambiguous retry never create another.

### Tests for User Story 4

- [x] T062 [P] [US4] Add Fusion header authentication, createfolder request, error classification, and redaction contract fixtures in tests/foxit-esign-client.test.ts
- [x] T063 [P] [US4] Add failing approval-consumption, idempotency, race, and denial integration tests in tests-integration/esign-dispatch.test.ts
- [x] T064 [P] [US4] Add failing ambiguous timeout and provider reconciliation tests in tests-integration/esign-reconciliation.test.ts
- [x] T065 [P] [US4] Add dispatcher-role and exact pre-send rehash browser tests in tests-browser/esign-dispatch.spec.ts

### Implementation for User Story 4

- [x] T066 [P] [US4] Define a fail-closed eSign adapter and classified results in src/server/foxit/esign-adapter.ts
- [x] T067 [US4] Implement server-only Fusion credential headers and create-envelope client in src/server/foxit/esign-client.ts
- [x] T068 [US4] Add dispatch attempts, provider envelopes, stable keys, and correlation constraints in migrations/0005_esign_dispatch.sql
- [x] T069 [US4] Extend atomic outbox enqueue and approval consumption in src/server/workflow/postgres-store.ts
- [x] T070 [US4] Connect isolated dispatch and reconciliation adapters in src/server/workflow/outbox-worker.ts
- [x] T071 [US4] Implement dispatcher-only idempotent route in src/app/api/workflows/[workflowId]/dispatch/route.ts
- [x] T072 [US4] Add dispatch confirmation, denial, queued, sent, and reconcile states in src/app/workflows/[workflowId]/dispatch-panel.tsx
- [x] T073 [US4] Document Foxit eSign credentials, scopes, sandbox signer consent, and one-operation live gate in docs/foxit-esign-setup.md
- [ ] T074 [US4] Execute one explicitly authorized sandbox dispatch and stage private correlation evidence with scripts/run-live-esign-proof.ts

**Checkpoint**: One real provider envelope can exist, and only behind current human authority.

---

## Phase 7: User Story 5 - Verify Human Completion (Priority: P5)

**Goal**: Authenticate provider lifecycle events, retrieve final bytes, and display a correlated audit timeline.

**Independent Test**: A consenting signer completes one sandbox envelope; forged and duplicate events cannot corrupt state; final bytes are independently hashed.

### Tests for User Story 5

- [x] T075 [P] [US5] Add raw-body HMAC, size, signature, replay, rotation, and malformed payload fixtures in tests/foxit-webhook.test.ts
- [x] T076 [P] [US5] Add out-of-order lifecycle and monotonic transition tests in tests/provider-lifecycle.test.ts
- [x] T077 [P] [US5] Add executed PDF retrieval, parser, digest, and quarantine tests in tests-integration/executed-document.test.ts
- [x] T078 [P] [US5] Add completed timeline and forged-event browser tests in tests-browser/verified-completion.spec.ts

### Implementation for User Story 5

- [x] T079 [P] [US5] Implement raw-body HMAC verification and typed Foxit event parsing in src/server/provider/foxit-webhook.ts
- [x] T080 [US5] Add provider events, lifecycle state, executed documents, and deduplication constraints in migrations/0006_verified_completion.sql
- [x] T081 [US5] Implement deduplicated monotonic event persistence in src/server/provider/event-store.ts
- [x] T082 [US5] Add bounded unauthenticated-provider webhook route in src/app/api/webhooks/foxit-esign/route.ts
- [x] T083 [US5] Implement envelope details, activity history, and executed-file download in src/server/foxit/esign-client.ts
- [x] T084 [US5] Validate, store, hash, and correlate executed bytes in src/server/provider/completion-worker.ts
- [x] T085 [US5] Add authorized hash-linked timeline route in src/app/api/workflows/[workflowId]/timeline/route.ts
- [x] T086 [US5] Build provider-correlated completion and audit timeline UI in src/app/workflows/[workflowId]/timeline.tsx
- [ ] T087 [US5] Run the signed journey, duplicate/forged events, and executed-byte proof in scripts/capture-completion-evidence.ts

**Checkpoint**: Completion is a verified artifact and event history, not a provider-call claim.

---

## Phase 8: User Story 6 - Reproduce the Winning Demonstration (Priority: P6)

**Goal**: Make the real, simulated, blocked, and planned boundaries obvious and reproducible in under ten minutes.

**Independent Test**: A fresh reviewer follows the documented story and maps every claim to sanitized evidence without private access.

### Tests for User Story 6

- [x] T088 [P] [US6] Add evidence manifest, digest, date, link, and claim-status tests in tests/evidence-manifest.test.ts
- [x] T089 [P] [US6] Add secret, PII, PDF-text, and raw-provider-payload privacy scan tests in tests/evidence-privacy.test.ts
- [x] T090 [P] [US6] Add fresh-checkout judge journey and ten-minute timing test in tests-browser/judge-journey.spec.ts

### Implementation for User Story 6

- [x] T091 [P] [US6] Define implemented, demonstrated, fixture, and planned claim vocabulary in src/core/evidence/claims.ts
- [x] T092 [US6] Implement evidence sanitization, manifest hashing, and verification in src/core/evidence/manifest.ts
- [x] T093 [US6] Add evidence verify and privacy-scan CLIs in scripts/verify-evidence.ts and scripts/scan-evidence-privacy.ts
- [x] T094 [US6] Update architecture, threat boundaries, and truthful milestone status in docs/architecture.md, docs/threat-model.md, and docs/roadmap.md
- [x] T095 [US6] Write the reproducible judge runbook and explicit live-step warnings in docs/demo-runbook.md
- [x] T096 [US6] Create English video script, shot list, real-data frame plan, and caption transcript draft in docs/media/demo-video-draft.md
- [x] T097 [US6] Create English and Spanish build-in-public post drafts with dated evidence links in docs/media/build-post-en-draft.md and docs/media/build-post-es-draft.md
- [x] T098 [US6] Create competition submission copy with exact Foxit integration claims in docs/submission-draft.md
- [x] T099 [US6] Run the clean-checkout judge journey, evidence verification, privacy scan, and link validation from specs/001-secure-signing-journey/quickstart.md

**Checkpoint**: Submission material is ready for review but remains unpublished until separately authorized.

---

## Phase 9: Polish and Cross-Cutting Release Gates

**Purpose**: Close requirements-review findings and prove the whole system repeatedly.

- [x] T100 [P] Resolve every reviewer finding in specs/001-secure-signing-journey/checklists/release-security.md with linked requirement edits
- [x] T101 [P] Add accessibility and responsive review requirements and tests in docs/accessibility.md and tests-browser/accessibility.spec.ts
- [x] T102 [P] Add retention, cleanup, failure reconciliation, backup, and restore operations in docs/data-lifecycle.md
- [x] T103 Add observability for budgets, denied dispatch, reconciliation, webhook rejection, cleanup, and quarantine in src/server/observability/security-events.ts
- [x] T104 Run pnpm check twice from a clean checkout and record only sanitized results in docs/verification.md
- [x] T105 Run TEST_DATABASE_URL=postgresql://... pnpm test:integration twice against an isolated database and record sanitized results in docs/verification.md
- [ ] T106 Run the fixture journey, attack matrix, and one separately authorized live journey from specs/001-secure-signing-journey/quickstart.md
  - Reversible fixture, browser, attack, contract, integration, restore, privacy,
    and fail-closed operator gates passed again on 2026-08-26. The task remains
    open solely because its separately authorized live journey has not run.
- [x] T107 Review public wording for dated credit cost, scoped tamper evidence, legal boundary, and implementation status in README.md and docs/
- [ ] T108 Obtain final human go/no-go for deployment, public evidence, live dispatch, media, and submission as separate release decisions in docs/release-checklist.md
  - Deployment and existing sanitized fixture evidence were separately authorized
    and completed on 2026-08-26. Live provider, webhook, media, and submission
    decisions remain open and independent.

---

## Dependencies and Execution Order

### Phase Dependencies

- Setup → Foundational → US1 safe public workspace.
- US2 depends on Foundational and uses US1 ownership/budgets for public deployment.
- US3 depends on US2's exact review snapshot.
- US4 depends on US1 budgets and US3 approval consumption.
- US5 depends on US4 provider correlation.
- US6 can draft fixture materials after US3, but final evidence depends on US5.
- Polish depends on all stories selected for the release.

### User Story Dependency Graph

```text
US1 Safe Public Workspace ─┬─> US2 Agentic Review ─> US3 Exact Approval ─> US4 eSign ─> US5 Completion ─> US6 Demo
                          └────────────────────────> US4
```

### Within Each User Story

- Test tasks run first and MUST fail for the intended missing behavior.
- Schema and domain contracts precede repositories and adapters.
- Server services precede route and UI wiring.
- Independent story checkpoint passes before advancing to the next priority.

### Parallel Opportunities

- Setup T002–T004 can run in parallel after T001.
- Foundational test tasks T007–T010 can run in parallel.
- Each story's test tasks marked `[P]` can run together before implementation.
- Documentation and evidence drafts in US6 can run in parallel after the claim vocabulary exists.
- Do not parallelize tasks that edit the same migration, route, store, or provider client.

## Parallel Examples

```text
US1: T020 auth tests | T021 tenant tests | T022 budget races | T023 browser denial
US3: T050 golden vectors | T051 approval integration | T052 attack matrix | T053 browser ceremony
US5: T075 webhook fixtures | T076 lifecycle tests | T077 executed PDF | T078 browser completion
```

## Implementation Strategy

### MVP First

Complete Setup, Foundational, and US1. Deploy only the authenticated workspace plus
read-only fixture showcase. This is a safe operational MVP, not the competition-complete product.

### Winning Slice

Then complete US2 and US3 together as the first judge-visible differentiator: intent
becomes an exact review, approval binds it, mutation visibly fails. No eSign credentials
are enabled until that slice passes.

### Provider Closure

Complete US4 and US5 with fixtures first, then authorize exactly one bounded live proof.
US6 packages only sanitized evidence and stays in draft until publication approval.

## Notes

- Every task has an exact path; task identifiers are execution ordered.
- `[P]` means different files and no dependency on another incomplete task in that phase.
- Story labels map directly to the six prioritized stories in `spec.md`.
- Publication, deployment, credential entry, and live dispatch remain human gates.
