export type LiveReadinessPhase = "dispatch" | "completion" | "all";

const COMMON = [
  "AUTH_SESSION_SECRET", "DATABASE_URL", "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET", "SIGNLATCH_ARTIFACT_ROOT",
  "SIGNLATCH_GITHUB_OPERATORS", "SIGNLATCH_MAINTAINER_TENANT_ID",
] as const;
const DISPATCH = [
  "FOXIT_ESIGN_BASE_URL", "FOXIT_ESIGN_CLIENT_ID", "FOXIT_ESIGN_CLIENT_SECRET",
  "FOXIT_ESIGN_ENVELOPE_PATH",
] as const;
const COMPLETION = [
  "FOXIT_ESIGN_ACTIVITY_PATH", "FOXIT_ESIGN_DETAILS_PATH",
  "FOXIT_ESIGN_EXECUTED_DOCUMENT_PATH", "FOXIT_ESIGN_WEBHOOK_SECRET",
  "SIGNLATCH_PRIVATE_EVIDENCE_ROOT",
] as const;
const CLOSED_GATES = [
  "SIGNLATCH_ESIGN_ENQUEUE_ENABLED", "SIGNLATCH_ESIGN_WORKER_ENABLED",
  "SIGNLATCH_COMPLETION_WORKER_ENABLED", "SIGNLATCH_COMPLETION_EVIDENCE_ENABLED",
] as const;

export type LiveReadiness = Readonly<{
  schema: "signlatch.live-readiness.v1";
  phase: LiveReadinessPhase;
  configurationReady: boolean;
  missing: readonly string[];
  activationGatesClosed: boolean;
  openGates: readonly string[];
}>;

export function inspectLiveReadiness(
  phase: LiveReadinessPhase,
  env: Readonly<Record<string, string | undefined>>,
): LiveReadiness {
  const required = new Set<string>(COMMON);
  if (phase === "dispatch" || phase === "all") for (const key of DISPATCH) required.add(key);
  if (phase === "completion" || phase === "all") for (const key of [...DISPATCH, ...COMPLETION]) required.add(key);
  const missing = [...required].filter((key) => !env[key]?.trim()).sort();
  const openGates = CLOSED_GATES.filter((key) => env[key]?.trim() === "true").sort();
  return {
    schema: "signlatch.live-readiness.v1",
    phase,
    configurationReady: missing.length === 0,
    missing,
    activationGatesClosed: openGates.length === 0,
    openGates,
  };
}

export function parseLiveReadinessPhase(argv: readonly string[]): LiveReadinessPhase {
  const tokens = argv[0] === "--" ? argv.slice(1) : [...argv];
  if (tokens.length === 0) return "all";
  if (tokens.length !== 2 || tokens[0] !== "--phase") {
    throw new Error("Usage: pnpm operator:live-preflight -- --phase dispatch|completion|all");
  }
  const phase = tokens[1];
  if (phase !== "dispatch" && phase !== "completion" && phase !== "all") {
    throw new Error("Live readiness phase must be dispatch, completion, or all");
  }
  return phase;
}
