alter table dispatch_outbox
  add column if not exists leased_by text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_error text;

alter table dispatch_outbox drop constraint if exists dispatch_outbox_status_check;
alter table dispatch_outbox add constraint dispatch_outbox_status_check
  check (status in ('pending', 'processing', 'reconcile', 'sent', 'failed'));

create index if not exists dispatch_outbox_reconcile_idx
  on dispatch_outbox (created_at)
  where status = 'reconcile';
