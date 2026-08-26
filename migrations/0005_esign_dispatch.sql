create table if not exists esign_dispatches (
  dispatch_id uuid primary key,
  workflow_id uuid not null references agreement_workflows on delete cascade,
  approval_id uuid not null unique references exact_approvals,
  tenant_id uuid not null references tenants,
  idempotency_key text not null unique,
  approval_digest text not null check (approval_digest ~ '^[a-f0-9]{64}$'),
  document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','processing','sent','reconcile','denied')),
  attempt_count integer not null default 0,
  lease_generation integer not null default 0,
  leased_by text,
  lease_expires_at timestamptz,
  provider_envelope_id text unique,
  provider_correlation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists esign_dispatches_queue_idx on esign_dispatches (status, created_at);
