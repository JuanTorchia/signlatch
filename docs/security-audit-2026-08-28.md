# Security audit — 2026-08-28

## Executive summary

Independent runtime, security, and adversarial reviewers assessed commit `e5e550d`
after an ambiguous Foxit sandbox call. The system correctly prevented a duplicate send,
but it was not operationally diagnosable or contest-ready. This remediation addresses
provider diagnostics, local failure classification, workflow transitions, bounded
response reads, provider-origin pinning, user-facing reconciliation state, and an
operator report. No second provider request was made during this work.

## High priority findings

### SEC-01 — Provider diagnostics were discarded

- Severity: High
- Location: `src/server/foxit/esign-client.ts`, `createEnvelope`
- Impact: timeouts, malformed success responses, and 5xx responses were indistinguishable.
- Remediation: bounded response reading plus an allowlisted diagnostic containing status,
  content type, byte count, response hash, phase, code, and safe top-level keys.

### SEC-02 — Workflow state diverged from provider state

- Severity: High
- Location: `src/server/workflow/esign-dispatch-store.ts`
- Impact: a dispatch could be sent or require reconciliation while the workflow remained
  `dispatching`, misleading users and operators.
- Remediation: atomic transitions to `sent`, `reconcile`, or `failed`, with budget-row
  update assertions.

### SEC-03 — Configured paths or redirects could forward credentials cross-origin

- Severity: Medium
- Location: `src/server/foxit/esign-client.ts`, `pathFor` and `assertConfig`
- Impact: a scheme-relative configured path could redirect authenticated retrieval to a
  different HTTPS origin.
- Remediation: reject `//`, backslashes, and any constructed URL whose origin differs
  from the configured Foxit origin; all authenticated requests use `redirect: manual`
  and fail closed on 3xx responses.

### SEC-05 — Safe retries were immediately eligible

- Severity: High
- Location: `src/server/workflow/esign-dispatch-store.ts`
- Impact: a rate limit could cause a tight retry loop that ignored provider guidance.
- Remediation: migration `0009` adds durable scheduling; the worker honors numeric
  `Retry-After` and otherwise uses bounded exponential backoff.

### SEC-04 — Local preflight failures looked like possible sends

- Severity: High
- Location: `src/server/foxit/exact-dispatch-adapter.ts`
- Impact: missing artifacts or recipient/field mismatches could strand budget in
  reconciliation even though no network request occurred.
- Remediation: build and validate the provider request before the network boundary and
  return a typed local denial.

## Open findings

- High: production roles currently grant one maintainer approver and dispatcher powers;
  add an enforced two-person mode before claiming separation of duties.
- High: Foxit webhook authentication currently arrives in a query parameter; verify the
  provider contract and ensure edge logs strip query strings before rotating the secret.
- Medium: the reconciliation runner is implemented but must remain disabled until Foxit
  confirms a lookup mechanism for this account; the read-only report does not pretend
  that capability currently exists.
- Low: normalize public API errors and add CSRF protection to sign-out.

## Security controls retained

Exact human approval, immutable artifact rehashing, tenant checks, parameterized SQL,
durable budget reservation, lease fencing, independent live gates, and the prohibition
on blind retry all remain in force.
