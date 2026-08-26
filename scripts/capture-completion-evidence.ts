import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { database } from "../src/server/database";
import { buildCompletionEvidence } from "../src/server/provider/completion-evidence";

async function main() {
  if (process.env.SIGNLATCH_COMPLETION_EVIDENCE_ENABLED !== "true") {
    throw new Error("Completion evidence capture requires its independent live gate");
  }
  const workflowId = process.argv[2];
  if (!workflowId) throw new Error("Usage: pnpm completion:evidence -- <workflow-uuid>");
  const configuredRoot = process.env.SIGNLATCH_PRIVATE_EVIDENCE_ROOT?.trim();
  if (!configuredRoot || !path.isAbsolute(configuredRoot)) {
    throw new Error("SIGNLATCH_PRIVATE_EVIDENCE_ROOT must be an absolute private path");
  }

  const sql = database();
  try {
    const evidence = await buildCompletionEvidence(sql, workflowId, new Date());
    await mkdir(configuredRoot, { recursive: true });
    const target = path.join(configuredRoot, `${workflowId}-completion.json`);
    await writeFile(target, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ status: "staged-private", evidenceSha256: evidence.evidenceSha256 })}\n`);
  } finally {
    await sql.end();
  }
}

void main();
