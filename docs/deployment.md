# Deployment operations

This document describes the intended Bulbasaur container deployment. It does not
claim that production is provisioned. Deployment remains a separate human gate.

## Services and trust boundaries

- `web`: public HTTPS UI and authenticated route handlers; no migration credentials.
- `dispatch-worker`: disabled Compose profile until exact approval and eSign gates pass.
- `migrate`: one-shot operations profile with a dedicated migration credential.
- `postgres`: private network only; authoritative ownership, budgets, leases, and audit.
- `artifacts`: private persistent volume mounted only by authorized application services.
- `parser`: `qpdf` runs with fixed arguments, bounded input/output/time, and a private
  temporary directory. The production host must additionally enforce the 256 MiB
  container/cgroup memory limit documented in the feature specification.

## Migration procedure

1. Take and verify a PostgreSQL backup plus artifact-volume snapshot.
2. Set `MIGRATION_DATABASE_URL` only on the one-shot migration identity; never expose it
   to web or workers.
3. Run `pnpm db:migrate`. The runner serializes execution with a PostgreSQL advisory
   lock, applies numeric migration files transactionally, records checksums, and rejects
   checksum drift. The Compose equivalent is `docker compose --profile operations run --rm migrate`.
4. Run the tenant, budget, restore, and artifact-integrity probes.
5. Start the web service with the dispatch-worker profile disabled.
6. Enable a worker only after its story gate passes and an operator authorizes it.

The dispatch worker has a separate `SIGNLATCH_ESIGN_WORKER_ENABLED` gate and recovers
expired leases into reconciliation instead of retrying blindly. Executed-document
retrieval is a separate one-shot operation: enable `SIGNLATCH_COMPLETION_WORKER_ENABLED`
only after a verified completion event, then run `pnpm completion:run -- <envelope-id>`.

## HTTPS and health

Terminate TLS at the existing host reverse proxy, redirect HTTP to HTTPS, preserve the
original scheme, and set HSTS only after HTTPS has been validated. The container
healthcheck proves process availability; an external check must also exercise the
read-only showcase. Health endpoints must never query Foxit or consume credits.

## Backup and restore

- PostgreSQL continuous archiving must provide an RPO of five minutes or less.
- Nightly database and artifact snapshots share the longest active document retention.
- A daily automated restore probe uses an isolated database and private scratch volume.
- The restore probe verifies row counts, artifact SHA-256 values, audit-chain continuity,
  and a full service RTO of one hour or less.
- A failed backup or restore probe pages the operator and blocks deployments and live grants.

## Secrets and runtime verification

Inject secrets from host-managed files or environment configuration excluded from the
repository. Run `pnpm runtime:verify` during container startup to pin the Foxit MCP
executable digest, module root, and working directory. Never log secret values.

## Rollback

Application rollback uses the prior immutable image. Database rollback is forward-only:
restore from the verified backup when a migration cannot be corrected safely. Never
delete or rewrite audit history to make it match an application narrative.
