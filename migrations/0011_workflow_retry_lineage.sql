alter table agreement_workflows
  add column if not exists retry_of_workflow_id uuid references agreement_workflows(workflow_id);

create unique index if not exists agreement_workflows_one_retry_idx
  on agreement_workflows(retry_of_workflow_id)
  where retry_of_workflow_id is not null;
