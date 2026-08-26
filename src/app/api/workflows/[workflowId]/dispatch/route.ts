import { artifactRootFromEnv, FilesystemArtifactStore } from "@/server/artifacts/filesystem-store";
import { requireCurrentCapability } from "@/server/auth/authorize";
import { requireRequestCsrf, sessionFromRequest, sessionTokenFromRequest } from "@/server/auth/request-session";
import { database } from "@/server/database";
import { ESignDispatchStore } from "@/server/workflow/esign-dispatch-store";
import { ReviewStore } from "@/server/workflow/review-store";
import { SecurityStore } from "@/server/workflow/security-store";
import { ProviderOperations } from "@/server/workflow/provider-operations";
import { createHash } from "node:crypto";

export async function POST(request: Request, context: RouteContext<"/api/workflows/[workflowId]/dispatch">) {
  if (process.env.SIGNLATCH_ESIGN_ENQUEUE_ENABLED !== "true") return Response.json({ error: "eSign enqueue requires an explicit live gate" }, { status: 503 });
  try {
    const session = sessionFromRequest(request); requireRequestCsrf(request, sessionTokenFromRequest(request));
    const sql = database(); await requireCurrentCapability(new SecurityStore(sql), session, "dispatch");
    const { workflowId } = await context.params; const review = await new ReviewStore(sql).getReview(workflowId, session.tenantId);
    if (!review) return new Response("Not found", { status: 404 });
    const sha = String(review.artifact_sha256); const reviewDigest=String(review.snapshot_digest);const bytes = await new FilesystemArtifactStore(artifactRootFromEnv()).getVerifiedPdf(sha);const now=new Date();
    const requestDigest=createHash("sha256").update(`${workflowId}:${reviewDigest}:${sha}`).digest("hex");const operations=new ProviderOperations(sql);const reservation=await operations.reserve({tenantId:session.tenantId,kind:"esign-dispatch",idempotencyKey:`dispatch:${reviewDigest}`,requestDigest,now});
    try{const result = await new ESignDispatchStore(sql).enqueue({ workflowId, tenantId: session.tenantId, expectedReviewDigest: reviewDigest, artifactBytes: bytes, operationId:reservation.operationId,now });return Response.json({...result,operationId:reservation.operationId}, { status: 202 });}catch(error){if(!reservation.existing)await operations.releaseReservation(reservation.operationId);throw error;}
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Dispatch denied" }, { status: 409 }); }
}
