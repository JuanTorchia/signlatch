alter table provider_events
  drop constraint if exists provider_events_event_type_check;

alter table provider_events
  add constraint provider_events_event_type_check
  check (event_type in (
    'created', 'sent', 'viewed', 'signed', 'completed', 'executed',
    'declined', 'cancelled'
  ));

alter table esign_dispatches
  drop constraint if exists esign_dispatches_lifecycle_state_check;

alter table esign_dispatches
  add constraint esign_dispatches_lifecycle_state_check
  check (lifecycle_state in (
    'created', 'sent', 'viewed', 'signed', 'completed', 'executed',
    'declined', 'cancelled'
  ));
