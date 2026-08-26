# Foxit eSign setup and live gate

SignLatch keeps eSign disabled by default. Fixture tests do not need credentials and
must run before any account configuration.

The account administrator must activate eSign for the application, confirm its storage
region, obtain the Fusion Client ID and Client Secret, and confirm signer-consent
requirements in the Foxit Developer Portal. The current v2.3.0 reference uses those
credentials directly as the `client_id` and `client_secret` request headers; there is
no OAuth token exchange in this Fusion contract.

Store `FOXIT_ESIGN_CLIENT_ID`, `FOXIT_ESIGN_CLIENT_SECRET`, and the webhook secret only
in the server secret manager. Configure a credential-free HTTPS base URL. Never expose
tokens to React, logs, evidence, or repository files.

The server requires the create-envelope, details, activity, and executed-document paths.
The v2.3.0 reference values are prefilled in `.env.example`. A correlation lookup path
is optional because the public reference does not document lookup by custom field; if
an ambiguous create response cannot be reconciled, SignLatch stops instead of creating
a second envelope. Paths are configuration, not permission to call them.

Foxit signs the exact raw webhook body with HMAC-SHA-256, Base64-encodes the digest,
and appends it as the callback URL's `signature` query parameter. SignLatch verifies
that value in constant time before parsing. Configure the webhook URL as
`https://<host>/api/webhooks/foxit-esign` and set a strong channel secret only in the
server secret manager.

Before a live proof, an operator must record all of the following as one bounded grant:

1. sandbox account and confirmed API scopes;
2. one consenting test signer and exact recipient address;
3. exact workflow, review, approval, and artifact digests;
4. a provider budget of one operation with a 15-minute expiry;
5. immediate human authorization to enable `SIGNLATCH_ESIGN_ENQUEUE_ENABLED=true`.

Enqueue authorization and worker execution are separate. An ambiguous response enters
reconciliation and must never be retried as a new envelope. Live correlation evidence
stays private until separately reviewed and authorized for publication.

After the authenticated `folder_executed` event, executed-document retrieval and evidence
capture have their own `SIGNLATCH_COMPLETION_WORKER_ENABLED` and
`SIGNLATCH_COMPLETION_EVIDENCE_ENABLED` gates. Evidence is generated from the correlated
database rows with provider identifiers hashed; operators do not supply claimed digests.

Run `pnpm operator:live-preflight -- --phase all` before asking for a live grant. The
preflight performs no network request, prints only missing variable names and open gate
names, and exits nonzero until configuration is complete with every effect gate closed.
