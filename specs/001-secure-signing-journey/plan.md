# Implementation Plan: Secure Signing Journey

**Branch**: `001-secure-signing-journey` | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-secure-signing-journey/spec.md`

**Note**: This template is filled in by the `$speckit-plan` command; its definition describes the execution workflow.

## Summary

Extend the proven approval envelope, workflow store, Foxit MCP preparation boundary,
and attack harness into a deployable procurement-agreement journey. The design adds
tenant authentication and ownership, durable effect budgets and leases, structured
intent generation, sandboxed PDF validation, exact review and approval, an isolated
direct Foxit eSign adapter, authenticated lifecycle webhooks, executed-document
verification, and sanitized public evidence. Fixtures remain the default demo path;
real provider work is an explicitly authorized bounded mode.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5 on Node.js 20+; Python 3.11+ only for the official Foxit MCP child process

**Primary Dependencies**: Next.js 16.3.2, React 19.2.8, postgres 3.4.9, MCP SDK 1.30.0, official Foxit PDF MCP server, Foxit eSign REST API

**Storage**: PostgreSQL for authoritative workflow state; private content-addressed artifact volume for PDF bytes; repository fixtures for sanitized demo evidence

**Testing**: Node test runner through tsx; PostgreSQL integration tests; browser journey; provider contract fixtures; approval attack harness

**Target Platform**: Containerized Linux server on the existing Bulbasaur host, public HTTPS, PostgreSQL, private persistent volume

**Project Type**: Full-stack web application with route handlers and background workers

**Performance Goals**: Review pages render stored state within 1 second at p95; non-provider mutations acknowledge within 500 ms at p95; 20 duplicate effect requests collapse to one operation

**Constraints**: Fail closed; exact approval binding; no secrets or private PDF content in public evidence; bounded Foxit credits; MCP child cancellation; raw-body webhook verification; no blind dispatch retry

**Scale/Scope**: Hackathon-scale public showcase, tens of authenticated developers, one procurement template, one Foxit sandbox account, multi-instance correctness

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Human Authority Is Exact — PASS**: approval binds every dispatch-relevant value;
  mutation creates a new version and can never revive a consumed or invalid approval.
- **Least-Authority Identity Separation — PASS**: agent, approver, and dispatcher are
  separate application capabilities; provider credentials are unavailable to the agent.
- **Verifiable Evidence Over Claims — PASS**: digests are computed from bytes at each
  boundary; provider and public claims map to sanitized dated evidence.
- **Safe and Budgeted External Effects — PASS**: authentication, ownership, durable
  budgets, leases, idempotency, and read-only public mode precede provider enablement.
- **Test-First Adversarial Delivery — PASS**: each boundary has contract, integration,
  and negative tests before implementation tasks.

**Post-design re-check**: PASS. The data model makes roles, exact versions, one-time
approval, budgets, provider correlations, and append-only audit state explicit. API
contracts expose no autonomous approval or public effect route. Quickstart includes
mutation, duplicate, malformed input, webhook forgery, and tenant-isolation scenarios.

## Project Structure

### Documentation (this feature)

```text
specs/001-secure-signing-journey/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output ($speckit-plan command)
├── data-model.md        # Phase 1 output ($speckit-plan command)
├── quickstart.md        # Phase 1 output ($speckit-plan command)
├── contracts/           # Phase 1 output ($speckit-plan command)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── app/
│   ├── api/                 # authenticated workflow, approval, dispatch, webhook routes
│   └── workflows/           # review, mutation demo, signing and timeline UI
├── core/
│   ├── agreement/           # structured procurement intent and deterministic rendering input
│   ├── approval/            # existing canonical envelope and mutation proof
│   ├── evidence/            # sanitization and claim manifest
│   └── workflow/            # state machine, audit and policy invariants
└── server/
    ├── artifacts/           # authorized byte store and sandboxed validation
    ├── auth/                # sessions, tenants and capabilities
    ├── foxit/               # MCP preparation and isolated eSign adapter
    ├── provider/            # webhook verification and reconciliation
    └── workflow/            # PostgreSQL repositories, budgets, leases and workers

tests/                       # unit, contract fixtures and adversarial tests
tests-integration/           # PostgreSQL, provider adapter and route integration tests
tests-browser/               # independent end-to-end judge and tenant journeys
scripts/                     # harness, evidence capture and safe operator commands
docs/                        # architecture, operations, setup and truthful public status
```

**Structure Decision**: Keep the existing single Next.js project and extend its
current `src/core`, `src/server`, and `src/app` boundaries. Do not introduce a
monorepo or second application. Provider subprocesses remain an adapter detail.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
No constitution violations require exceptions.
