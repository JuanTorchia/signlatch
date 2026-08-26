import path from "node:path";
import { FilesystemArtifactStore } from "@/server/artifacts/filesystem-store";
import { requireCurrentCapability } from "@/server/auth/authorize";
import { requireRequestCsrf, sessionFromRequest, sessionTokenFromRequest } from "@/server/auth/request-session";
import { database } from "@/server/database";
import { ESignDispatchStore } from "@/server/workflow/esign-dispatch-store";
import { ReviewStore } from "@/server/workflow/review-store";
import { SecurityStore } from "@/server/workflow/security-store";

export async function POST(request: Request, context: RouteContext<"/api/workflows/[workflowId]/dispatch">) {
  if (process.env.SIGNLATCH_ESIGN_ENQUEUE_ENABLED !== "true") return Response.json({ error: "eSign enqueue requires an explicit live gate" }, { status: 503 });
  try {
    const session = sessionFromRequest(request); requireRequestCsrf(request, sessionTokenFromRequest(request));
    const sql = database(); await requireCurrentCapability(new SecurityStore(sql), session, "dispatch");
    const { workflowId } = await context.params; const review = await new ReviewStore(sql).getReview(workflowId, session.tenantId);
    if (!review) return new Response("Not found", { status: 404 });
    const sha = String(review.artifact_sha256); const bytes = await new FilesystemArtifactStore(path.join(process.cwd(), ".data", "artifacts")).getVerifiedPdf(sha);
    const result = await new ESignDispatchStore(sql).enqueue({ workflowId, tenantId: session.tenantId, expectedReviewDigest: String(review.snapshot_digest), artifactBytes: bytes, now: new Date() });
    return Response.json(result, { status: 202 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Dispatch denied" }, { status: 409 }); }
}
