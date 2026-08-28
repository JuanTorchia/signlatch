import type { JSONValue, Sql } from "postgres";

import { nextLifecycle } from "./lifecycle";
import type { FoxitWebhookEvent } from "./foxit-webhook";

export class ProviderEventStore {
  constructor(private readonly sql: Sql) {}

  async record(event: FoxitWebhookEvent) {
    return this.sql.begin(async (tx) => {
      const rows = await tx<Array<{
        dispatch_id: string;
        workflow_id: string;
        lifecycle_state: FoxitWebhookEvent["type"];
      }>>`
        select dispatch_id, workflow_id, lifecycle_state
        from esign_dispatches
        where provider_envelope_id = ${event.envelopeId}
        for update
      `;
      const dispatch = rows[0];
      if (!dispatch) throw new Error("Unknown provider envelope");

      const inserted = await tx`
        insert into provider_events(
          event_id, provider_envelope_id, dispatch_id, event_type,
          occurred_at, sanitized_payload
        ) values (
          ${event.eventId}, ${event.envelopeId}, ${dispatch.dispatch_id},
          ${event.type}, ${event.occurredAt},
          ${tx.json({ eventId: event.eventId, type: event.type } as JSONValue)}
        ) on conflict(event_id) do nothing
      `;
      const state = inserted.count === 0
        ? dispatch.lifecycle_state
        : nextLifecycle(dispatch.lifecycle_state, event.type);

      if (inserted.count !== 0) {
        await tx`
          update esign_dispatches
          set lifecycle_state = ${state}, updated_at = now()
          where dispatch_id = ${dispatch.dispatch_id}
        `;
      }
      if (state === "executed") {
        await tx`
          update agreement_workflows
          set state = 'completed', updated_at = now()
          where workflow_id = ${dispatch.workflow_id} and state = 'sent'
        `;
      }
      return { duplicate: inserted.count === 0, state };
    });
  }
}
