import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "postgres";

import { buildCompletionEvidence } from "../src/server/provider/completion-evidence";

const workflowId = "00000000-0000-4000-8000-000000000091";

function sqlFixture(completed = true): Sql {
  return (async (strings: TemplateStringsArray) => {
    const query = strings.join("?");
    if (query.includes("from esign_dispatches d")) {
      return completed ? [{
        provider_envelope_id: "private-envelope-id",
        lifecycle_state: "completed",
        artifact_sha256: "a".repeat(64),
        actual_size: 123,
        verified_at: new Date("2026-08-26T13:04:00Z"),
      }] : [];
    }
    if (query.includes("from provider_events e")) {
      return [
        { event_id: "private-event-1", event_type: "sent", occurred_at: new Date("2026-08-26T13:01:00Z") },
        { event_id: "private-event-2", event_type: "completed", occurred_at: new Date("2026-08-26T13:03:00Z") },
      ];
    }
    return [];
  }) as unknown as Sql;
}

test("completion evidence is derived from correlated database state and hashes provider identifiers", async () => {
  const evidence = await buildCompletionEvidence(sqlFixture(), workflowId, new Date("2026-08-26T13:05:00Z"));
  assert.equal(evidence.executedArtifactSha256, "a".repeat(64));
  assert.equal(evidence.timelineEventCount, 2);
  assert.match(evidence.providerEnvelopeIdHash, /^[a-f0-9]{64}$/);
  assert.match(evidence.timelineDigest, /^[a-f0-9]{64}$/);
  assert.match(evidence.evidenceSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(evidence).includes("private-envelope-id"), false);
  assert.equal(JSON.stringify(evidence).includes("private-event-1"), false);
});

test("completion evidence fails closed without one verified completed document", async () => {
  await assert.rejects(
    () => buildCompletionEvidence(sqlFixture(false), workflowId, new Date()),
    /no unique verified completion/,
  );
});
