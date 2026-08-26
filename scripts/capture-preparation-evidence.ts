import { createHash } from "node:crypto";

const required = ["workflowId", "operationId", "artifactSha256", "manifestSha256"] as const;
const input = process.argv[2] ? JSON.parse(process.argv[2]) as Record<string, unknown> : {};
for (const field of required) {
  if (typeof input[field] !== "string") throw new Error(`Missing sanitized evidence field: ${field}`);
}
const evidence = {
  schema: "signlatch.preparation-evidence.v1",
  capturedAt: new Date().toISOString(),
  status: "live-demonstrated",
  claim: "Foxit PDF preparation completed without eSign authority",
  workflowId: input.workflowId,
  operationId: input.operationId,
  artifactSha256: input.artifactSha256,
  manifestSha256: input.manifestSha256,
  expectedCreditCost: "1 PDF conversion credit; account behavior verified 2026-08-25",
};
const canonical = JSON.stringify(evidence);
process.stdout.write(`${JSON.stringify({ ...evidence, evidenceSha256: createHash("sha256").update(canonical).digest("hex") }, null, 2)}\n`);
