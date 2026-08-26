<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Added principles: Human Authority Is Exact; Least-Authority Identity Separation;
  Verifiable Evidence Over Claims; Safe and Budgeted External Effects;
  Test-First Adversarial Delivery
- Added sections: Security and Product Constraints; Delivery and Evidence Gates
- Removed sections: none
- Deferred items: none
-->
# SignLatch Constitution

## Core Principles

### I. Human Authority Is Exact
Every irreversible action MUST require a fresh human approval that binds the exact
artifact digest, recipient set, field placement, policy findings, and dispatch
intent. Any mutation to a bound value MUST invalidate approval and visibly block
dispatch. Document preparation, preview, or prior approval MUST NOT be interpreted
as authorization to send. Rationale: the product exists to preserve human authority
at the irreversible boundary.

### II. Least-Authority Identity Separation
Preparation, approval, and dispatch MUST execute under distinct roles with the
minimum privileges required. An agent identity MAY prepare and analyze documents
but MUST NOT approve or dispatch them. A human approver MAY authorize exact values
but MUST NOT silently alter the approved payload. A dispatcher MAY consume a valid
approval but MUST NOT create or broaden it. Rationale: role separation makes both
accidental escalation and compromised-agent abuse containable and testable.

### III. Verifiable Evidence Over Claims
Security, provider, and completion claims MUST be backed by reproducible evidence.
Artifacts MUST be hashed at ingestion and reverified before use or delivery.
Provider identifiers, webhook authenticity, executed-document retrieval, and audit
events MUST be correlated without exposing secrets or personal document contents.
Public language MUST accurately scope properties such as immutability and MUST date
time-sensitive cost or provider behavior claims. Rationale: judges and users must be
able to distinguish demonstrated guarantees from aspirations.

### IV. Safe and Budgeted External Effects
Every route or worker capable of consuming credits, sending documents, changing
provider state, or exposing private artifacts MUST be authenticated, authorized,
owned by a tenant, rate limited, and protected by durable idempotency and budget
controls. Public demonstrations MUST be read-only unless an explicitly authorized
operator starts a bounded live run. Remote artifacts MUST follow a documented
retention and cleanup policy. Rationale: a public showcase must not create an
unbounded financial, privacy, or operational liability.

### V. Test-First Adversarial Delivery
Changes to trust boundaries MUST begin with failing contract, integration, or attack
tests that express the intended invariant. Each user story MUST remain independently
demonstrable. The mutation path, authorization denial, duplicate delivery, timeout,
malformed PDF, and forged webhook cases MUST be exercised before a milestone is
called complete. Rationale: the strongest part of SignLatch is the visible proof that
unsafe actions fail closed.

## Security and Product Constraints

- Foxit PDF operations MUST remain reversible and restricted by an explicit tool
  allowlist; Foxit eSign dispatch MUST use an isolated adapter and credential scope.
- PDF acceptance MUST use a sandboxed structural parser with bounded input, time,
  memory, and output rather than lexical checks alone.
- Provider subprocesses MUST have pinned executables and working directories,
  bounded request bodies, cancellation that terminates children, and sanitized logs.
- Workflow state, concurrency leases, idempotency keys, credit budgets, ownership,
  approvals, and audit events MUST be durable in production.
- Secrets, credentials, private documents, personal data, and raw provider payloads
  MUST NOT enter the public repository or public evidence bundle.
- The product provides workflow risk signals, not legal advice. It MUST NOT claim
  universal legal validity, absolute immutability, or completion not proven by
  provider evidence.

## Delivery and Evidence Gates

Each feature follows Specify, Clarify, Plan, Checklist, Tasks, Analyze, Implement,
and Converge. Planning MUST pass the constitution check before implementation.
Tests are required for security boundaries and external interfaces. `pnpm check`
MUST pass before a change is presented as ready; database and provider integration
gates MUST also pass when their behavior changes.

A milestone is complete only when its acceptance scenarios, negative paths, public
documentation, and sanitized evidence are reproducible. A technical PASS does not
authorize deployment, publication, enrollment, payments, acceptance of terms, or
provider dispatch. Those actions require explicit human authorization at the time
of action.

## Governance

This constitution supersedes conflicting project practices and feature documents.
Every plan and review MUST cite how it satisfies each applicable MUST rule. An
amendment requires a documented rationale, migration impact, explicit maintainer
approval, and an update to dependent active specifications before implementation
continues.

Versioning follows semantic versioning: MAJOR for incompatible principle removals or
redefinitions, MINOR for new principles or materially expanded obligations, and
PATCH for non-semantic clarification. Compliance is reviewed at planning, before
merge, before public deployment, and before any irreversible provider action.

**Version**: 1.0.0 | **Ratified**: 2026-08-25 | **Last Amended**: 2026-08-25
