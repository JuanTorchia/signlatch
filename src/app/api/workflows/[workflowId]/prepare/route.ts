import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import { createReviewSnapshot } from "@/core/agreement/review";
import { evaluateAgreementPolicy } from "@/core/agreement/policy";
import { renderAgreementText } from "@/core/agreement/render";
import { validateAgreementIntent } from "@/core/agreement/intent";
import { FilesystemArtifactStore } from "@/server/artifacts/filesystem-store";
import { requireCurrentCapability } from "@/server/auth/authorize";
import { requireRequestCsrf, sessionFromRequest, sessionTokenFromRequest } from "@/server/auth/request-session";
import { database } from "@/server/database";
import { FoxitStdioMcpClient, foxitMcpConfigFromEnv } from "@/server/foxit/mcp-client";
import { prepareTextPdf } from "@/server/foxit/prepare-text-pdf";
import { ProviderOperations } from "@/server/workflow/provider-operations";
import { ReviewStore } from "@/server/workflow/review-store";
import { SecurityStore } from "@/server/workflow/security-store";

export async function POST(request: Request, context: RouteContext<"/api/workflows/[workflowId]/prepare">) {
  if (process.env.SIGNLATCH_DEMO_ENABLED !== "true") return Response.json({ error: "Live preparation is disabled" }, { status: 503 });
  const { workflowId } = await context.params;
  try {
    const session = sessionFromRequest(request);
    requireRequestCsrf(request, sessionTokenFromRequest(request));
    const sql = database();
    const security = new SecurityStore(sql);
    await requireCurrentCapability(security, session, "prepare");
    const reviewStore = new ReviewStore(sql);
    const current = await reviewStore.getOwnedIntent(workflowId, session.tenantId);
    if (!current) return new Response("Not found", { status: 404 });
    const validationErrors = validateAgreementIntent(current.intent);
    if (validationErrors.length) return Response.json({ error: "Material facts are unresolved", unresolvedFacts: validationErrors }, { status: 409 });

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16) return Response.json({ error: "Idempotency-Key required" }, { status: 400 });
    const requestDigest = createHash("sha256").update(`${workflowId}:${current.intent.sourceRequestSha256}`).digest("hex");
    const operations = new ProviderOperations(sql);
    const reservation = await operations.reserve({ tenantId: session.tenantId, kind: "pdf-prepare", idempotencyKey, requestDigest, now: new Date() });
    if (reservation.existing) return Response.json({ operationId: reservation.operationId, status: reservation.state }, { status: 202 });
    const lease = await operations.start(reservation.operationId, `review:${randomUUID()}`, new Date());
    if (!lease) return Response.json({ operationId: reservation.operationId, status: "reserved" }, { status: 202 });
    try {
      const result = await prepareTextPdf(renderAgreementText(current.intent), new FoxitStdioMcpClient(foxitMcpConfigFromEnv()), new FilesystemArtifactStore(path.join(process.cwd(), ".data", "artifacts")));
      const findings = evaluateAgreementPolicy(current.intent);
      const recipients = current.intent.signers.map((signer, index) => ({ id: signer.id, email: signer.email, order: index + 1 }));
      const fields = recipients.map((recipient) => ({ id: `signature-${recipient.id}`, recipientId: recipient.id, page: 1, rectangle: [100, 700, 300, 760] as [number, number, number, number] }));
      const snapshot = createReviewSnapshot({ workflowId, intent: current.intent, artifactSha256: result.artifact.sha256, recipients, fields, findings, provenanceSha256: result.manifest.manifestSha256 });
      await security.registerArtifact({ tenantId: session.tenantId, sha256: result.artifact.sha256, storageKey: result.artifact.storageKey, actualSize: result.artifact.size, retentionDeadline: new Date(Date.now() + 7 * 86_400_000) });
      const reviewVersion = await reviewStore.savePreparedReview({ workflowId, tenantId: session.tenantId, artifactSha256: result.artifact.sha256, actualSize: result.artifact.size, provenanceSha256: result.manifest.manifestSha256, snapshot });
      await operations.succeed(lease, result.artifact.sha256, { workflowId, reviewVersion, snapshotDigest: snapshot.digest });
      return Response.json({ workflowId, reviewVersion, snapshotDigest: snapshot.digest, artifactSha256: result.artifact.sha256 }, { status: 201 });
    } catch (error) {
      await operations.reconcile(lease);
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Preparation failed safely" }, { status: 400 });
  }
}
