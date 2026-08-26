import { requireCurrentCapability } from "@/server/auth/authorize";
import { requireRequestCsrf, sessionFromRequest, sessionTokenFromRequest } from "@/server/auth/request-session";
import { database } from "@/server/database";
import { readBoundedBody } from "@/server/http/bounded-body";
import { structureAgreementIntent } from "@/server/agent/agreement-agent";
import { ReviewStore } from "@/server/workflow/review-store";
import { SecurityStore } from "@/server/workflow/security-store";

export async function POST(request: Request) {
  try {
    const session = sessionFromRequest(request);
    requireRequestCsrf(request, sessionTokenFromRequest(request));
    const sql = database();
    await requireCurrentCapability(new SecurityStore(sql), session, "prepare");
    const bytes = await readBoundedBody(request, 64 * 1024);
    const body = JSON.parse(new TextDecoder().decode(bytes)) as { request?: unknown };
    if (typeof body.request !== "string") return Response.json({ error: "Agreement request is required" }, { status: 400 });
    const intent = structureAgreementIntent(body.request);
    const workflowId = await new ReviewStore(sql).createWorkflow(session.tenantId, session.principalId, intent);
    return Response.json({ workflowId, intent, ready: intent.unresolvedFacts.length === 0 }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Workflow creation failed" }, { status: 400 });
  }
}
