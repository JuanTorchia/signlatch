import { randomBytes } from "node:crypto";

import { requireCurrentCapability } from "@/server/auth/authorize";
import { requireRequestCsrf, sessionFromRequest, sessionTokenFromRequest } from "@/server/auth/request-session";
import { database } from "@/server/database";
import { ApprovalStore } from "@/server/workflow/approval-store";
import { SecurityStore } from "@/server/workflow/security-store";

export async function POST(request: Request, context: RouteContext<"/api/workflows/[workflowId]/approve">) {
  try {
    const session = sessionFromRequest(request);
    requireRequestCsrf(request, sessionTokenFromRequest(request));
    const sql = database();
    await requireCurrentCapability(new SecurityStore(sql), session, "approve");
    const { workflowId } = await context.params;
    const body = await request.json() as { reviewVersion?: number; reviewDigest?: string };
    const now = new Date();
    const result = await new ApprovalStore(sql).approveExact({
      schema: "signlatch.exact-approval.v2", tenantId: session.tenantId, workflowId,
      reviewVersion: body.reviewVersion ?? 0, reviewDigest: body.reviewDigest ?? "",
      approverId: session.principalId, nonce: randomBytes(24).toString("base64url"),
      issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Approval denied" }, { status: 409 });
  }
}
