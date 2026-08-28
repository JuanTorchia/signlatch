import { randomUUID } from "node:crypto";

import { database } from "../src/server/database";
import { FoxitESignClient, foxitESignConfigFromEnv } from "../src/server/foxit/esign-client";
import { ESignDispatchStore } from "../src/server/workflow/esign-dispatch-store";
import { JsonSecurityEventSink, securityEvent } from "../src/server/observability/security-events";
import { processNextReconciliation } from "../src/server/workflow/outbox-worker";

async function main() {
  if (process.env.SIGNLATCH_ESIGN_RECONCILIATION_ENABLED !== "true") throw new Error("Reconciliation requires its independent live gate");
  if (process.env.SIGNLATCH_FOXIT_CORRELATION_LOOKUP_CONFIRMED !== "true") throw new Error("Foxit lookup must be documented or confirmed for this account");
  if (!process.env.FOXIT_ESIGN_CORRELATION_PATH?.includes("{idempotencyKey}")) throw new Error("A documented Foxit idempotency lookup path is required");
  const sql = database();
  const store = new ESignDispatchStore(sql);
  const client = new FoxitESignClient(foxitESignConfigFromEnv());
  const events = new JsonSecurityEventSink();
  const workerId = `reconciler:${randomUUID()}`;
  let stopping = false;
  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });
  try {
    while (!stopping) {
      const now = new Date();
      const result = await processNextReconciliation(store, client, workerId, now, reconciliationDelay);
      if (result.status === "idle") { await new Promise((resolve) => setTimeout(resolve, 15_000)); continue; }
      process.stdout.write(`${JSON.stringify({schema:"signlatch.reconciliation.v1",result:result.status,workflowId:result.workflowId,attempt:result.attempt})}\n`);
      if (result.status !== "resolved") await events.emit(securityEvent("dispatch_reconcile", { workflowId: result.workflowId, reasonCode: result.reasonCode }));
    }
  } finally {
    await sql.end();
  }
}

function reconciliationDelay(attempt: number): number {
  return Math.min(24 * 60 * 60_000, 60_000 * 2 ** Math.min(10, Math.max(0, attempt - 1)));
}

void main();
