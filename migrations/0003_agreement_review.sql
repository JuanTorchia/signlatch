create table if not exists agreement_workflows (
  workflow_id uuid primary key,
  tenant_id uuid not null references tenants on delete cascade,
  owner_principal_id uuid not null references principals,
  state text not null default 'draft' check (state in ('draft','preparing','review','approved','dispatching','sent','reconcile','completed','failed')),
  active_intent_version integer not null default 1,
  active_document_version integer,
  active_review_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agreement_intents (
  workflow_id uuid not null references agreement_workflows on delete cascade,
  version integer not null,
  payload jsonb not null,
  source_request_sha256 text not null check (source_request_sha256 ~ '^[a-f0-9]{64}$'),
  unresolved_facts text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (workflow_id, version)
);

create table if not exists document_versions (
  workflow_id uuid not null references agreement_workflows on delete cascade,
  version integer not null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  actual_size bigint not null check (actual_size between 1 and 10485760),
  structural_validator text not null,
  provenance_sha256 text not null check (provenance_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (workflow_id, version)
);

create table if not exists review_snapshots (
  workflow_id uuid not null references agreement_workflows on delete cascade,
  version integer not null,
  document_version integer not null,
  snapshot_digest text not null check (snapshot_digest ~ '^[a-f0-9]{64}$'),
  snapshot_payload jsonb not null,
  prior_version integer,
  material_diff jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (workflow_id, version),
  unique (workflow_id, snapshot_digest),
  foreign key (workflow_id, document_version) references document_versions
);

create index if not exists agreement_workflows_owner_idx
  on agreement_workflows (tenant_id, owner_principal_id, updated_at desc);
