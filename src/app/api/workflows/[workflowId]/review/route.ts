import { requireCurrentCapability } from "@/server/auth/authorize";
import { sessionFromRequest } from "@/server/auth/request-session";
import { database } from "@/server/database";
import { ReviewStore } from "@/server/workflow/review-store";
import { SecurityStore } from "@/server/workflow/security-store";

export async function GET(request: Request, context: RouteContext<"/api/workflows/[workflowId]/review">) {
  try {
    const session = sessionFromRequest(request);
    const sql = database();
    await requireCurrentCapability(new SecurityStore(sql), session, "read");
    const { workflowId } = await context.params;
    const review = await new ReviewStore(sql).getReview(workflowId, session.tenantId);
    return review ? Response.json(review) : new Response("Not found", { status: 404 });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
