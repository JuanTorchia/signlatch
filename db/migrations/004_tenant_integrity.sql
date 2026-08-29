alter table dispatch_outbox
  add constraint dispatch_outbox_workflow_tenant_fk
  foreign key (workflow_id, tenant_id)
  references workflows (workflow_id, tenant_id);

alter table audit_events
  add constraint audit_events_workflow_tenant_fk
  foreign key (workflow_id, tenant_id)
  references workflows (workflow_id, tenant_id);
