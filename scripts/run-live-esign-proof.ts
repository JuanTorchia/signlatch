import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { artifactRootFromEnv, FilesystemArtifactStore } from "../src/server/artifacts/filesystem-store";
import { database } from "../src/server/database";
import { ExactFoxitDispatchAdapter } from "../src/server/foxit/exact-dispatch-adapter";
import { FoxitESignClient, foxitESignConfigFromEnv } from "../src/server/foxit/esign-client";
import { assertLiveProofAuthorization, parseLiveProofArguments } from "../src/server/operator/live-proof-gate";
import { ESignDispatchStore } from "../src/server/workflow/esign-dispatch-store";

async function main() {
  const args = parseLiveProofArguments(process.argv.slice(2));
  assertLiveProofAuthorization(args, process.env);

  const sql = database();
  try {
    const workflowId = args.workflow;
    const checks = await sql<Array<{
      snapshot_digest: string;
      artifact_sha256: string;
      snapshot_payload: { recipients: Array<{ email: string }> };
    }>>`
      select r.snapshot_digest, r.snapshot_payload, d.artifact_sha256
      from agreement_workflows w
      join review_snapshots r on r.workflow_id=w.workflow_id and r.version=w.active_review_version
      join document_versions d on d.workflow_id=w.workflow_id and d.version=w.active_document_version
      where w.workflow_id=${workflowId}
    `;
    const current = checks[0];
    if (current?.snapshot_digest !== args["review-digest"]
      || current?.artifact_sha256 !== args["artifact-sha256"]) {
      throw new Error("Live proof digests do not match current workflow");
    }
    if (current.snapshot_payload.recipients.length !== 1
      || current.snapshot_payload.recipients[0].email.toLowerCase() !== args.recipient.toLowerCase()) {
      throw new Error("Authorized recipient does not match exact review");
    }

    const store = new ESignDispatchStore(sql);
    const lease = await store.leaseNext(`live-proof:${randomUUID()}`, new Date(), 120, workflowId);
    if (!lease) throw new Error("No exact pending dispatch exists for the authorized workflow");
    const adapter = new ExactFoxitDispatchAdapter(
      sql,
      new FoxitESignClient(foxitESignConfigFromEnv()),
      new FilesystemArtifactStore(artifactRootFromEnv()),
    );
    const result = await adapter.send(lease);
    if (result.status === "sent") await store.markSent(lease, result.providerEnvelopeId, result.correlationId);
    else {
      await store.markReconcile(
        lease,
        "correlationId" in result ? result.correlationId : undefined,
        "diagnostic" in result ? result.diagnostic : undefined,
      );
      throw new Error(`Provider result requires reconciliation: ${result.status}`);
    }

    const evidence = {
      schema: "signlatch.live-esign-private.v1",
      capturedAt: new Date().toISOString(),
      workflowId,
      reviewDigest: args["review-digest"],
      artifactSha256: args["artifact-sha256"],
      providerEnvelopeIdHash: createHash("sha256").update(result.providerEnvelopeId).digest("hex"),
      authorizationIdHash: createHash("sha256").update(args["authorization-id"]).digest("hex"),
    };
    const configuredEvidenceRoot=process.env.SIGNLATCH_PRIVATE_EVIDENCE_ROOT?.trim();
    if(configuredEvidenceRoot&&!path.isAbsolute(configuredEvidenceRoot))throw new Error("SIGNLATCH_PRIVATE_EVIDENCE_ROOT must be absolute");
    if(process.env.NODE_ENV==="production"&&!configuredEvidenceRoot)throw new Error("SIGNLATCH_PRIVATE_EVIDENCE_ROOT is required in production");
    const root = configuredEvidenceRoot??path.join(process.cwd(), ".data", "evidence-staging");
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, `${workflowId}.json`), `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ status: "sent", privateEvidence: "staged-private" }));
  } finally {
    await sql.end();
  }
}

void main();
