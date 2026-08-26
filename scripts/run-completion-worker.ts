import { artifactRootFromEnv, FilesystemArtifactStore } from "../src/server/artifacts/filesystem-store";
import { database } from "../src/server/database";
import { FoxitESignClient, foxitESignConfigFromEnv } from "../src/server/foxit/esign-client";
import { CompletionWorker } from "../src/server/provider/completion-worker";

async function main() {
  if (process.env.SIGNLATCH_COMPLETION_WORKER_ENABLED !== "true") {
    throw new Error("Completion worker requires its independent live gate");
  }
  const envelopeId = process.argv[2];
  if (!envelopeId) throw new Error("Usage: pnpm completion:run -- <provider-envelope-id>");

  const sql = database();
  try {
    const worker = new CompletionWorker(
      sql,
      new FoxitESignClient(foxitESignConfigFromEnv()),
      new FilesystemArtifactStore(artifactRootFromEnv()),
    );
    const artifact = await worker.complete(envelopeId);
    process.stdout.write(`${JSON.stringify({ sha256: artifact.sha256, size: artifact.size })}\n`);
  } finally {
    await sql.end();
  }
}

void main();
