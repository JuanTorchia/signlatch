import { requireCurrentCapability } from "@/server/auth/authorize";
import { requireRequestCsrf, sessionFromRequest, sessionTokenFromRequest } from "@/server/auth/request-session";
import { database } from "@/server/database";
import { ReviewStore } from "@/server/workflow/review-store";
import { SecurityStore } from "@/server/workflow/security-store";

export async function POST(request: Request, context: RouteContext<"/api/workflows/[workflowId]/mutations">) {
  try {
    const session = sessionFromRequest(request);
    requireRequestCsrf(request, sessionTokenFromRequest(request));
    const sql = database();
    await requireCurrentCapability(new SecurityStore(sql), session, "mutate");
    const { workflowId } = await context.params;
    const body = await request.json() as { kind?: "artifact" | "recipient" };
    if (body.kind !== "artifact" && body.kind !== "recipient") throw new Error("Only explicit demo mutations are permitted");
    const snapshot = await new ReviewStore(sql).createMutation(workflowId, session.tenantId, (input) => {
      if (body.kind === "artifact") input.artifactSha256 = input.artifactSha256 === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64);
      else input.recipients[0] = { ...input.recipients[0], email: `mutated-${input.recipients[0].email}` };
      return input;
    });
    return Response.json({ snapshotDigest: snapshot.digest, approvalInvalidated: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Mutation denied" }, { status: 409 });
  }
}
