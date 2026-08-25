create table if not exists workflows (
  workflow_id text primary key,
  tenant_id text not null,
  state text not null check (state in (
    'preparing', 'review', 'approved', 'dispatching', 'reconcile', 'sent', 'failed', 'completed'
  )),
  version integer not null check (version > 0),
  approval_id text unique,
  approval_digest text,
  approval_envelope jsonb,
  provider_envelope_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, tenant_id)
);

create table if not exists dispatch_outbox (
  outbox_id uuid primary key,
  workflow_id text not null references workflows(workflow_id),
  tenant_id text not null,
  approval_id text not null unique,
  idempotency_key text not null unique,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dispatch_outbox_pending_idx
  on dispatch_outbox (available_at, created_at)
  where status = 'pending';

create table if not exists audit_events (
  sequence bigint generated always as identity primary key,
  event_id uuid not null unique,
  workflow_id text not null references workflows(workflow_id),
  tenant_id text not null,
  event_type text not null,
  actor_id text not null,
  occurred_at timestamptz not null,
  event_data jsonb not null,
  previous_hash text not null check (previous_hash ~ '^[a-f0-9]{64}$'),
  event_hash text not null unique check (event_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists audit_events_workflow_idx
  on audit_events (workflow_id, sequence);
