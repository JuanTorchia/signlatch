import { inspectLiveReadiness, parseLiveReadinessPhase } from "../src/server/operator/live-readiness";

const result = inspectLiveReadiness(parseLiveReadinessPhase(process.argv.slice(2)), process.env);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.configurationReady || !result.activationGatesClosed) process.exitCode = 1;
