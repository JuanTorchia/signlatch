alter table esign_dispatches
  add column if not exists reconciliation_attempt_count integer not null default 0,
  add column if not exists next_reconciliation_at timestamptz not null default now(),
  add column if not exists reconciliation_leased_by text,
  add column if not exists reconciliation_lease_expires_at timestamptz,
  add column if not exists reconciliation_lease_generation integer not null default 0;

create index if not exists esign_dispatches_reconciliation_queue_idx
  on esign_dispatches (status, next_reconciliation_at, created_at)
  where status = 'reconcile';
