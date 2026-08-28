import { database } from "../src/server/database";
import { ESignDispatchStore } from "../src/server/workflow/esign-dispatch-store";

function argument(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

async function main() {
  if (process.env.SIGNLATCH_RECONCILIATION_ABSENT_CLOSE_ENABLED !== "true") {
    throw new Error("Confirmed-absence closure requires an explicit live gate");
  }
  const workflowId = argument("workflow");
  const evidenceSha256 = argument("evidence-sha256");
  const authorizationId = argument("authorization-id");
  const sql = database();
  try {
    const result = await new ESignDispatchStore(sql).resolveReconciliationAbsent(workflowId, evidenceSha256, authorizationId);
    process.stdout.write(`${JSON.stringify({ status: result.status, workflowId, evidenceSha256: result.evidenceSha256, authorizationIdHash: result.authorizationIdHash })}\n`);
  } finally {
    await sql.end();
  }
}

void main();
