import { createHash } from "node:crypto";
import type { Sql } from "postgres";

type CompletionRow = {
  provider_envelope_id: string;
  lifecycle_state: string;
  artifact_sha256: string;
  actual_size: number | string;
  verified_at: Date;
};

type TimelineRow = {
  event_id: string;
  event_type: string;
  occurred_at: Date;
};

export async function buildCompletionEvidence(sql: Sql, workflowId: string, capturedAt: Date) {
  if (!/^[0-9a-f-]{36}$/i.test(workflowId)) throw new Error("A valid workflow UUID is required");
  const completions = await sql<Array<CompletionRow>>`
    select d.provider_envelope_id, d.lifecycle_state, x.artifact_sha256,
      x.actual_size, x.verified_at
    from esign_dispatches d
    join executed_documents x on x.dispatch_id = d.dispatch_id
    where d.workflow_id = ${workflowId}
  `;
  if (completions.length !== 1 || completions[0].lifecycle_state !== "completed") {
    throw new Error("Workflow has no unique verified completion");
  }
  const completion = completions[0];
  const events = await sql<Array<TimelineRow>>`
    select e.event_id, e.event_type, e.occurred_at
    from provider_events e
    join esign_dispatches d on d.dispatch_id = e.dispatch_id
    where d.workflow_id = ${workflowId}
    order by e.occurred_at, e.event_id
  `;
  if (!events.some((event) => event.event_type === "completed")) {
    throw new Error("Verified completion event is missing");
  }
  const timeline = events.map((event) => ({
    eventIdHash: digest(event.event_id),
    type: event.event_type,
    occurredAt: event.occurred_at.toISOString(),
  }));
  const timelineDigest = digest(`signlatch:provider-timeline:v1\n${JSON.stringify(timeline)}`);
  const evidence = {
    schema: "signlatch.completion-evidence.v1" as const,
    capturedAt: capturedAt.toISOString(),
    status: "live-demonstrated" as const,
    claim: "Authenticated Foxit eSign completion with independently hashed executed bytes",
    workflowId,
    providerEnvelopeIdHash: digest(completion.provider_envelope_id),
    executedArtifactSha256: completion.artifact_sha256,
    executedArtifactSize: Number(completion.actual_size),
    executedArtifactVerifiedAt: completion.verified_at.toISOString(),
    timelineEventCount: timeline.length,
    timelineDigest,
  };
  return { ...evidence, evidenceSha256: digest(JSON.stringify(evidence)) };
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
