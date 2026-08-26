alter table esign_dispatches
  add column if not exists provider_operation_id uuid unique references provider_operations;

create index if not exists esign_dispatches_provider_operation_idx
  on esign_dispatches (provider_operation_id) where provider_operation_id is not null;
