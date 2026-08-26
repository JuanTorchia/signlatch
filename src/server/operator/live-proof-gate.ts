const LIVE_PROOF_KEYS = [
  "workflow",
  "review-digest",
  "artifact-sha256",
  "recipient",
  "budget",
  "authorization-id",
] as const;

export type LiveProofArguments = Readonly<Record<(typeof LIVE_PROOF_KEYS)[number], string>>;

export function parseLiveProofArguments(argv: readonly string[]): LiveProofArguments {
  const tokens = argv[0] === "--" ? argv.slice(1) : [...argv];
  if (tokens.length % 2 !== 0) throw new Error("Live proof arguments must be --key value pairs");

  const parsed = new Map<string, string>();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!flag?.startsWith("--") || flag.length === 2 || !value || value.startsWith("--")) {
      throw new Error("Live proof arguments must be --key value pairs");
    }
    const key = flag.slice(2);
    if (!LIVE_PROOF_KEYS.includes(key as (typeof LIVE_PROOF_KEYS)[number])) {
      throw new Error(`Unknown live proof argument --${key}`);
    }
    if (parsed.has(key)) throw new Error(`Duplicate live proof argument --${key}`);
    parsed.set(key, value);
  }

  for (const key of LIVE_PROOF_KEYS) {
    if (!parsed.get(key)) throw new Error(`Live proof gate missing --${key}`);
  }
  if (parsed.get("budget") !== "1") throw new Error("Live proof budget must equal exactly one");
  for (const key of ["review-digest", "artifact-sha256"] as const) {
    if (!/^[a-f0-9]{64}$/.test(parsed.get(key)!)) throw new Error(`Live proof --${key} must be a lowercase SHA-256`);
  }

  return Object.fromEntries(LIVE_PROOF_KEYS.map((key) => [key, parsed.get(key)!])) as LiveProofArguments;
}

export function assertLiveProofAuthorization(
  args: LiveProofArguments,
  env: Readonly<Record<string, string | undefined>>,
): void {
  if (env.SIGNLATCH_ESIGN_ENQUEUE_ENABLED !== "true"
    || env.SIGNLATCH_ESIGN_WORKER_ENABLED !== "true"
    || env.SIGNLATCH_LIVE_PROOF_AUTHORIZATION_ID !== args["authorization-id"]) {
    throw new Error("Live proof is disabled without matching immediate human authorization");
  }
}
