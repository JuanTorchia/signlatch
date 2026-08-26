# Foxit eSign setup and live gate

SignLatch keeps eSign disabled by default. Fixture tests do not need credentials and
must run before any account configuration.

The account administrator must obtain the sandbox base URL, OAuth client credentials,
token path, envelope path, required scopes, webhook signing method, and signer-consent
requirements from the Foxit eSign API portal attached to the account. These values are
product- and account-specific; do not infer them from the PDF Services API.

Store `FOXIT_ESIGN_CLIENT_ID`, `FOXIT_ESIGN_CLIENT_SECRET`, and the webhook secret only
in the server secret manager. Configure a credential-free HTTPS base URL. Never expose
tokens to React, logs, evidence, or repository files.

The server also requires the account-confirmed token, envelope, details, activity,
executed-document, and correlation paths. Configure them through the corresponding
`FOXIT_ESIGN_*_PATH` variables shown in `.env.example`; paths are data, not permission
to call them. Verify the exact webhook signature header and algorithm against the
account's current Foxit documentation before exposing the callback.

Before a live proof, an operator must record all of the following as one bounded grant:

1. sandbox account and confirmed API scopes;
2. one consenting test signer and exact recipient address;
3. exact workflow, review, approval, and artifact digests;
4. a provider budget of one operation with a 15-minute expiry;
5. immediate human authorization to enable `SIGNLATCH_ESIGN_ENQUEUE_ENABLED=true`.

Enqueue authorization and worker execution are separate. An ambiguous response enters
reconciliation and must never be retried as a new envelope. Live correlation evidence
stays private until separately reviewed and authorized for publication.

After the authenticated completed event, executed-document retrieval and evidence
capture have their own `SIGNLATCH_COMPLETION_WORKER_ENABLED` and
`SIGNLATCH_COMPLETION_EVIDENCE_ENABLED` gates. Evidence is generated from the correlated
database rows with provider identifiers hashed; operators do not supply claimed digests.

Run `pnpm operator:live-preflight -- --phase all` before asking for a live grant. The
preflight performs no network request, prints only missing variable names and open gate
names, and exits nonzero until configuration is complete with every effect gate closed.
