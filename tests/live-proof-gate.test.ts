import assert from "node:assert/strict";
import test from "node:test";

import { assertLiveProofAuthorization, parseLiveProofArguments } from "../src/server/operator/live-proof-gate";

const values = [
  "--workflow", "00000000-0000-0000-0000-000000000000",
  "--review-digest", "a".repeat(64),
  "--artifact-sha256", "b".repeat(64),
  "--recipient", "consenting-signer@example.invalid",
  "--budget", "1",
  "--authorization-id", "private-decision-id",
];

test("parses the documented pnpm separator and exact live proof arguments", () => {
  const parsed = parseLiveProofArguments(["--", ...values]);
  assert.equal(parsed.workflow, "00000000-0000-0000-0000-000000000000");
  assert.equal(parsed["review-digest"], "a".repeat(64));
  assert.equal(parsed.budget, "1");
});

test("rejects malformed, unknown, duplicate, and over-budget arguments", () => {
  assert.throws(() => parseLiveProofArguments(values.slice(0, -1)), /pairs/);
  assert.throws(() => parseLiveProofArguments([...values, "--extra", "value"]), /Unknown/);
  assert.throws(() => parseLiveProofArguments([...values, "--budget", "1"]), /Duplicate/);
  assert.throws(() => parseLiveProofArguments(values.map((value) => value === "1" ? "2" : value)), /exactly one/);
  assert.throws(() => parseLiveProofArguments(values.map((value) => value === "a".repeat(64) ? "A".repeat(64) : value)), /lowercase SHA-256/);
});

test("requires both live gates and an exact fresh authorization id", () => {
  const parsed = parseLiveProofArguments(values);
  assert.throws(() => assertLiveProofAuthorization(parsed, {}), /immediate human authorization/);
  assert.throws(() => assertLiveProofAuthorization(parsed, {
    SIGNLATCH_ESIGN_ENQUEUE_ENABLED: "true",
    SIGNLATCH_ESIGN_WORKER_ENABLED: "true",
    SIGNLATCH_LIVE_PROOF_AUTHORIZATION_ID: "different",
  }), /immediate human authorization/);
  assert.doesNotThrow(() => assertLiveProofAuthorization(parsed, {
    SIGNLATCH_ESIGN_ENQUEUE_ENABLED: "true",
    SIGNLATCH_ESIGN_WORKER_ENABLED: "true",
    SIGNLATCH_LIVE_PROOF_AUTHORIZATION_ID: "private-decision-id",
  }));
});
