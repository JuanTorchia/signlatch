alter table esign_dispatches
  add column if not exists next_attempt_at timestamptz not null default now();

create index if not exists esign_dispatches_due_queue_idx
  on esign_dispatches (status, next_attempt_at, created_at);
