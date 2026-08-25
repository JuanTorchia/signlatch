alter table dispatch_outbox
  add column if not exists lease_generation bigint not null default 0;

create index if not exists dispatch_outbox_expired_lease_idx
  on dispatch_outbox (lease_expires_at, created_at)
  where status = 'processing';
