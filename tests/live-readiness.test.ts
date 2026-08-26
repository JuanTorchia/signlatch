import assert from "node:assert/strict";
import test from "node:test";

import { inspectLiveReadiness, parseLiveReadinessPhase } from "../src/server/operator/live-readiness";

const complete = {
  AUTH_SESSION_SECRET: "session", DATABASE_URL: "postgresql://private",
  GITHUB_OAUTH_CLIENT_ID: "github-id", GITHUB_OAUTH_CLIENT_SECRET: "github-secret",
  SIGNLATCH_ARTIFACT_ROOT: "/private/artifacts", SIGNLATCH_GITHUB_OPERATORS: "operator",
  SIGNLATCH_MAINTAINER_TENANT_ID: "tenant", FOXIT_ESIGN_BASE_URL: "https://sandbox.example.invalid",
  FOXIT_ESIGN_CLIENT_ID: "esign-id", FOXIT_ESIGN_CLIENT_SECRET: "esign-secret",
  FOXIT_ESIGN_CORRELATION_PATH: "/correlation/{idempotencyKey}", FOXIT_ESIGN_ENVELOPE_PATH: "/envelopes",
  FOXIT_ESIGN_TOKEN_PATH: "/oauth/token", FOXIT_ESIGN_ACTIVITY_PATH: "/envelopes/{envelopeId}/activity",
  FOXIT_ESIGN_DETAILS_PATH: "/envelopes/{envelopeId}",
  FOXIT_ESIGN_EXECUTED_DOCUMENT_PATH: "/envelopes/{envelopeId}/document",
  FOXIT_ESIGN_WEBHOOK_SECRET: "webhook-secret", SIGNLATCH_PRIVATE_EVIDENCE_ROOT: "/private/evidence",
};

test("reports only missing key names and keeps all live gates closed", () => {
  const result = inspectLiveReadiness("all", { DATABASE_URL: "postgresql://private" });
  assert.equal(result.configurationReady, false);
  assert.equal(result.activationGatesClosed, true);
  assert.ok(result.missing.includes("FOXIT_ESIGN_CLIENT_SECRET"));
  assert.equal(JSON.stringify(result).includes("postgresql://private"), false);
});

test("distinguishes dispatch readiness from completion readiness", () => {
  const withoutCompletion: Record<string, string> = { ...complete };
  delete withoutCompletion.FOXIT_ESIGN_WEBHOOK_SECRET;
  assert.equal(inspectLiveReadiness("dispatch", withoutCompletion).configurationReady, true);
  assert.equal(inspectLiveReadiness("completion", withoutCompletion).configurationReady, false);
});

test("reports an accidentally open effect gate", () => {
  const result = inspectLiveReadiness("all", { ...complete, SIGNLATCH_ESIGN_WORKER_ENABLED: "true" });
  assert.equal(result.configurationReady, true);
  assert.equal(result.activationGatesClosed, false);
  assert.deepEqual(result.openGates, ["SIGNLATCH_ESIGN_WORKER_ENABLED"]);
});

test("parses the documented optional pnpm separator", () => {
  assert.equal(parseLiveReadinessPhase([]), "all");
  assert.equal(parseLiveReadinessPhase(["--", "--phase", "dispatch"]), "dispatch");
  assert.throws(() => parseLiveReadinessPhase(["--phase", "unknown"]), /dispatch, completion, or all/);
});
