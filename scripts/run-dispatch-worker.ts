import { randomUUID } from "node:crypto";

import { artifactRootFromEnv, FilesystemArtifactStore } from "../src/server/artifacts/filesystem-store";
import { database } from "../src/server/database";
import { ExactFoxitDispatchAdapter } from "../src/server/foxit/exact-dispatch-adapter";
import { FoxitESignClient, foxitESignConfigFromEnv } from "../src/server/foxit/esign-client";
import { ESignDispatchStore } from "../src/server/workflow/esign-dispatch-store";
import { processNextExactDispatch } from "../src/server/workflow/outbox-worker";

async function main() {
  if (process.env.SIGNLATCH_ESIGN_WORKER_ENABLED !== "true") {
    throw new Error("eSign worker requires its independent live gate");
  }
  const sql = database();
  let stopping = false;
  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });
  try {
    const store = new ESignDispatchStore(sql);
    const adapter = new ExactFoxitDispatchAdapter(
      sql,
      new FoxitESignClient(foxitESignConfigFromEnv()),
      new FilesystemArtifactStore(artifactRootFromEnv()),
    );
    const workerId = `worker:${randomUUID()}`;
    while (!stopping) {
      const now = new Date();
      const recovered = await store.recoverExpiredLeases(now);
      const result = await processNextExactDispatch(store, adapter, workerId, now);
      process.stdout.write(`${JSON.stringify({ result, recovered })}\n`);
      if (result === "idle") await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  } finally {
    await sql.end();
  }
}

void main();
