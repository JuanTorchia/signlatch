# Data Model: Secure Signing Journey

All identifiers are opaque UUIDs. All mutable rows include `created_at` and
`updated_at`; security events use database time. Sensitive values are encrypted or
hashed where lookup semantics permit. Historical audit rows are append-only.

## Tenant and Principal

- `tenant`: id, display name, status, public-showcase flag.
- `principal`: id, identity provider, provider subject, display name, status.
- `membership`: tenant id, principal id, roles (`operator`, `approver`, `dispatcher`,
  `auditor`), granted/revoked timestamps.

Validation: active membership is checked at action time. The service identities for
agent and dispatcher are distinct principals and cannot hold `approver`.

## Provider Budget and Operation

- `provider_budget`: tenant, provider, operation kind, period, hard limit, consumed,
  reserved, version.
- `provider_operation`: tenant, kind, idempotency key, request digest, state, lease
  owner/generation/expiry, reserved units, provider correlation, result digest.

States: `reserved -> running -> succeeded | failed | reconcile`; expired `running`
operations enter `reconcile`. A unique tenant/kind/idempotency key prevents duplicates.

## Workflow and Agreement Intent

- `workflow`: tenant, owner, state, active document version, active approval,
  provider envelope, retention status.
- `agreement_intent`: workflow, version, original request digest, buyer, supplier,
  effective date, term, payment terms, liability cap, governing law, signers,
  clause selections, unresolved facts, generation provenance.

Intent is immutable by version. A new version is required for any material change.
The first template requires buyer, supplier, payment terms, liability cap, and one
authorized signer; unresolved required facts block review completion.

## Document Version

- `document_version`: workflow, version, artifact SHA-256, actual byte size, media
  type, structural validation result/version, source intent version, Foxit document
  correlation, sanitized provenance digest, quarantine status.
- `artifact`: tenant, SHA-256, private storage key, actual size, creation source,
  retention deadline, deletion state.

Artifact rows are content addressed and cannot be overwritten. A digest mismatch
quarantines the artifact and invalidates every referencing approval.

## Review Payload

- `recipient_set`: version, canonical ordered recipients with normalized delivery
  identity, role, signing order, and stable recipient id.
- `field_set`: version, canonical fields with type, assignee, page, rectangle,
  required flag, and stable field id.
- `finding_set`: policy version and ordered findings with rule id, severity, message,
  evidence reference, and acknowledgement requirement.
- `review_snapshot`: workflow, document version, intent version, recipient/field/
  finding set versions, canonical payload digest, prior snapshot and diff summary.

Canonicalization is versioned according to `contracts/approval-v2.md`. Unicode NFC,
recipient and field ordering, empty/invisible values, integer page coordinates, and
duplicate identities have explicit rejection rules.

## Approval Envelope

- `approval`: workflow, review snapshot, canonical approval digest, approver principal,
  approval identity, created/expiry time, status, invalidation reason, consumed time.

States: `valid -> invalidated | consumed | expired`. No state returns to `valid`.
Approval creation requires `approver`; consumption requires `dispatcher` and an exact
current snapshot match inside the same transaction.

## Dispatch and Provider Envelope

- `dispatch_attempt`: workflow, approval, operation, stable provider idempotency key,
  state, attempt count, last error class, reconciliation result.
- `provider_envelope`: tenant, workflow, Foxit folder/envelope id, account/base region,
  provider state, recipient correlation digest, created/executed timestamps.

States: `queued -> dispatching -> sent | reconcile | denied | failed`, then provider
lifecycle `sent -> viewed | signed | cancelled | executed`. Terminal states are
monotonic; out-of-order events may add evidence without regressing state.

## Provider Event and Executed Document

- `provider_event`: provider, event id or derived payload digest, received time, raw
  body digest, signature status, event name/date, envelope correlation, disposition.
- `executed_document`: provider envelope, artifact SHA-256, actual size, retrieved
  time, structural validation, provider activity-history digest.

Raw bodies expire after 24 hours and never enter public evidence. Provider responses
expire after 30 days. The unique provider/event key provides replay defense.

## Audit Event and Evidence Record

- `audit_event`: tenant, workflow, sequence, prior event digest, event digest, actor,
  role, type, timestamp, correlation ids, before/after reference digests, reason.
- `evidence_record`: claim id, evidence kind, captured date, source operation, artifact
  digest, sanitizer version, public path, verification status.

Audit events form a hash-linked append-only sequence. This is tamper-evident within
the application's trust boundary and is never described as globally immutable.
