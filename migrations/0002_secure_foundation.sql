create table if not exists tenants (
  tenant_id uuid primary key,
  display_name text not null check (length(display_name) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'suspended')),
  public_showcase boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists principals (
  principal_id uuid primary key,
  provider text not null,
  provider_subject text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subject)
);

create table if not exists memberships (
  tenant_id uuid not null references tenants on delete cascade,
  principal_id uuid not null references principals on delete cascade,
  roles text[] not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (tenant_id, principal_id),
  check (roles <@ array['operator','approver','dispatcher','auditor']::text[])
);

create table if not exists provider_budgets (
  tenant_id uuid not null references tenants on delete cascade,
  provider text not null,
  operation_kind text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  hard_limit integer not null check (hard_limit >= 0),
  consumed integer not null default 0 check (consumed >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  version bigint not null default 1,
  primary key (tenant_id, provider, operation_kind, period_start),
  check (period_end > period_start),
  check (consumed + reserved <= hard_limit)
);

create table if not exists provider_operations (
  operation_id uuid primary key,
  tenant_id uuid not null references tenants on delete cascade,
  provider text not null,
  operation_kind text not null,
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  request_digest text not null check (request_digest ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('reserved','running','succeeded','failed','reconcile')),
  reserved_units integer not null default 1 check (reserved_units > 0),
  leased_by text,
  lease_generation bigint not null default 0,
  lease_expires_at timestamptz,
  provider_correlation text,
  result_digest text check (result_digest is null or result_digest ~ '^[a-f0-9]{64}$'),
  result_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, operation_kind, idempotency_key)
);

create table if not exists private_artifacts (
  tenant_id uuid not null references tenants on delete cascade,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  storage_key text not null,
  actual_size bigint not null check (actual_size between 1 and 10485760),
  status text not null default 'active' check (status in ('active','quarantined','deleted')),
  retention_deadline timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, sha256)
);

create table if not exists security_audit_events (
  event_id uuid primary key,
  tenant_id uuid not null references tenants on delete cascade,
  workflow_id text,
  sequence bigint not null,
  event_type text not null,
  actor_id text not null,
  actor_role text not null,
  occurred_at timestamptz not null default now(),
  correlation_ids jsonb not null default '{}'::jsonb,
  reason text,
  event_data jsonb not null default '{}'::jsonb,
  previous_hash text not null check (previous_hash ~ '^[a-f0-9]{64}$'),
  event_hash text not null check (event_hash ~ '^[a-f0-9]{64}$'),
  unique (tenant_id, workflow_id, sequence),
  unique (event_hash)
);

create index if not exists provider_operations_lease_idx
  on provider_operations (state, lease_expires_at, created_at);
create index if not exists private_artifacts_retention_idx
  on private_artifacts (status, retention_deadline);
