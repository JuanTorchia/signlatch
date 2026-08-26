create table if not exists provider_events (
  event_id text primary key,
  provider_envelope_id text not null,
  dispatch_id uuid not null references esign_dispatches on delete cascade,
  event_type text not null check (event_type in ('created','sent','viewed','completed','declined','cancelled')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  sanitized_payload jsonb not null default '{}'::jsonb
);
create table if not exists executed_documents (
  dispatch_id uuid primary key references esign_dispatches on delete cascade,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  actual_size bigint not null check (actual_size between 1 and 10485760),
  storage_key text not null,
  provider_envelope_id text not null unique,
  verified_at timestamptz not null default now()
);
alter table esign_dispatches add column if not exists lifecycle_state text not null default 'created'
  check (lifecycle_state in ('created','sent','viewed','completed','declined','cancelled'));
