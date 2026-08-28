import { requireCurrentCapability } from "@/server/auth/authorize";
import { requireRequestCsrf, sessionFromRequest, sessionTokenFromRequest } from "@/server/auth/request-session";
import { database } from "@/server/database";
import { ReviewStore } from "@/server/workflow/review-store";
import { SecurityStore } from "@/server/workflow/security-store";

export async function POST(request: Request, context: RouteContext<"/api/workflows/[workflowId]/retry">) {
  try {
    const session = sessionFromRequest(request);
    requireRequestCsrf(request, sessionTokenFromRequest(request));
    const sql = database();
    await requireCurrentCapability(new SecurityStore(sql), session, "prepare");
    const { workflowId } = await context.params;
    const retryWorkflowId = await new ReviewStore(sql).retryFailedWorkflow(
      workflowId,
      session.tenantId,
      session.principalId,
    );
    return Response.json({ workflowId: retryWorkflowId }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Retry denied" }, { status: 409 });
  }
}
