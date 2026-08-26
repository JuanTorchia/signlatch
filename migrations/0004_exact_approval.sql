alter table agreement_workflows
  add column if not exists active_approval_id uuid,
  add column if not exists approval_generation integer not null default 0;

create table if not exists exact_approvals (
  approval_id uuid primary key,
  workflow_id uuid not null references agreement_workflows on delete cascade,
  review_version integer not null,
  review_digest text not null check (review_digest ~ '^[a-f0-9]{64}$'),
  approval_digest text not null check (approval_digest ~ '^[a-f0-9]{64}$'),
  approver_principal_id uuid not null references principals,
  nonce text not null unique check (length(nonce) between 16 and 128),
  generation integer not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > issued_at),
  invalidated_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workflow_id, generation),
  foreign key (workflow_id, review_version) references review_snapshots
);

create unique index if not exists exact_approvals_one_live_idx
  on exact_approvals (workflow_id) where invalidated_at is null and consumed_at is null;
