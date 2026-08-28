import { database } from "../src/server/database";
import { FoxitESignClient, foxitESignConfigFromEnv } from "../src/server/foxit/esign-client";
import { FoxitActivityReconciler } from "../src/server/provider/activity-reconciler";
import { ProviderEventStore } from "../src/server/provider/event-store";

async function main() {
  if (process.env.SIGNLATCH_COMPLETION_WORKER_ENABLED !== "true") {
    throw new Error("Activity reconciliation requires the independent completion gate");
  }
  const envelopeId = process.argv[2];
  if (!envelopeId) throw new Error("Usage: pnpm completion:reconcile -- <provider-envelope-id>");
  const sql = database();
  try {
    const result = await new FoxitActivityReconciler(
      new FoxitESignClient(foxitESignConfigFromEnv()),
      new ProviderEventStore(sql),
    ).reconcile(envelopeId);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await sql.end();
  }
}

void main();
