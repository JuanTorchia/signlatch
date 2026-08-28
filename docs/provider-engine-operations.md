# Provider engine operations

## Diagnostic contract

Foxit response bodies, credentials, recipient data, PDF bytes, and webhook signatures
must never be logged. Every provider attempt may persist only this allowlisted envelope:

- phase and stable internal code;
- HTTP status and normalized content type;
- bounded response byte count and SHA-256;
- bounded top-level response key names;
- presence, never the value, of correlation and envelope identifiers.

The envelope response reader stops at 64 KiB; retrieval JSON stops at 256 KiB and an
executed PDF at 10 MiB. Larger bodies are rejected without parsing or persistence.
Retrieval paths must remain on the configured Foxit origin, and authenticated requests
use manual redirect handling so credentials are never forwarded by a redirect.

Safe retries use durable `next_attempt_at` scheduling. The worker honors a numeric
`Retry-After` in delta-seconds or HTTP-date form, clamps delays to 1 second–7 days,
and otherwise applies bounded
exponential backoff. The attempt code, sanitized diagnostic, and selected delay are
stored on the provider operation without response content.

## State ownership

The workflow, dispatch, provider operation, and budget transition in one database
transaction. Confirmed delivery moves the workflow to `sent`; uncertain delivery moves
it to `reconcile`; a confirmed denial moves it to `failed`. A reconcile state retains
the reserved unit and prohibits another create call.

Inspect a reconciliation without provider access:

```bash
pnpm operator:reconciliation-report -- <workflow-uuid>
```

This report is safe to store privately. It contains no provider identifiers or user
content. It does not resolve or authorize a retry.

## Automatic reconciliation worker

The reconciliation worker performs lookup-only requests and can never call
`createfolder`. It starts only when `SIGNLATCH_ESIGN_RECONCILIATION_ENABLED=true`,
`SIGNLATCH_FOXIT_CORRELATION_LOOKUP_CONFIRMED=true`, and
`FOXIT_ESIGN_CORRELATION_PATH` contains `{idempotencyKey}`. The confirmation flag may
be enabled only after Foxit documents or confirms that lookup for this account.

Run it with `pnpm reconciliation:start`. Each row is leased, unsuccessful lookups are
rescheduled with exponential backoff up to 24 hours, and another envelope is never
created. A discovered envelope atomically resolves the dispatch, workflow, operation,
and reserved budget. Absence from one lookup is not treated as proof that no envelope
exists.

## Reconciliation procedure

1. Keep enqueue and worker gates closed.
2. Generate the sanitized reconciliation report.
3. Search the Foxit sandbox for the exact time window and approved recipient.
4. If an envelope exists, record its identifier privately and resolve the existing
   dispatch; never create another envelope.
5. If Foxit or its portal conclusively proves that no envelope exists, preserve that
   evidence and obtain a new explicit human authorization before releasing the reserved
   unit or creating a new approval.
6. If neither condition is provable, retain `reconcile` and escalate to Foxit support.

When conclusive private evidence proves absence and a human authorizes closure, an
operator may temporarily enable `SIGNLATCH_RECONCILIATION_ABSENT_CLOSE_ENABLED` and
run `pnpm operator:reconciliation-close-absent -- --workflow <uuid>
--evidence-sha256 <sha256> --authorization-id <id>`. The transaction marks the old
dispatch and operation failed, releases (but does not consume) its reserved unit, and
records only the evidence digest and a hash of the authorization identifier. Disable
the gate immediately afterward. The command never creates an envelope, and a second
invocation is rejected.

The public Foxit reference documents `POST /esign/api/v1/folders/createfolder` as a
successful `200` response containing `folder.folderId`. It also documents
`GET /esign/api/v1/folders/myfolder?folderId=...`, which requires an already known ID.
It does not document a lookup by SignLatch's idempotency key, so the engine must not
claim provider-level exactly-once behavior without account-specific evidence.

References:

- https://app.developer-api.foxit.com/reference/tag/envelopes/POST/esign/api/v1/folders/createfolder
- https://developersguide.foxitesign.foxit.com/

## 2026-08-28 incident

One authorized sandbox attempt for workflow
`8602eba4-96b8-4245-bd1f-92b621221d81` returned no usable folder or correlation ID.
No invitation arrived. The pre-remediation client discarded the response classification,
so the exact provider response cannot be reconstructed. The dispatch and operation remain
in reconciliation with one reserved and zero consumed units. This is an unresolved
incident, not evidence of successful Foxit delivery.
