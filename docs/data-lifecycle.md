# Data lifecycle and recovery

Prepared and executed PDFs are private, content-addressed, rehashed on every read, and
quarantined when bytes differ. Provider temporary document IDs are scheduled for remote
cleanup within 24 hours. Private artifact retention defaults to seven days unless a
legal or competition evidence requirement establishes a documented shorter scope.

Ambiguous eSign delivery is retained for reconciliation and never blindly resent.
Webhook events are deduplicated by provider event ID. Raw provider payloads, document
text, credentials, and signer PII are excluded from public evidence.

Database backups must be encrypted with five-minute-or-better RPO and one-hour-or-better
RTO. A restore probe uses an isolated database, applies migrations in order, verifies
approval/outbox/event constraints and hash-linked audit history, then destroys only the
named disposable environment. Production restoration requires a separate operator
runbook and authorization.
