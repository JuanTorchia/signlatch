import { ArtifactIntegrityError } from "@/server/artifacts/artifact-errors";
import { artifactRootFromEnv, FilesystemArtifactStore } from "@/server/artifacts/filesystem-store";
import { requireCurrentCapability } from "@/server/auth/authorize";
import { sessionFromRequest } from "@/server/auth/request-session";
import { database } from "@/server/database";
import { SecurityStore } from "@/server/workflow/security-store";

export async function GET(_request: Request, context: RouteContext<"/api/artifacts/[sha]">) {
  const { sha } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(sha)) return new Response("Not found", { status: 404 });

  try {
    const session = sessionFromRequest(_request);
    const security = new SecurityStore(database());
    await requireCurrentCapability(security, session, "read");
    if (!(await security.ownsArtifact(session.tenantId, sha))) {
      return new Response("Not found", { status: 404 });
    }
    const store = new FilesystemArtifactStore(artifactRootFromEnv());
    const bytes = await store.getVerifiedPdf(sha);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="signlatch-${sha.slice(0, 12)}.pdf"`,
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'; sandbox",
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    if (error instanceof ArtifactIntegrityError) {
      return new Response("Artifact quarantined", { status: error.status });
    }
    return new Response("Not found", { status: 404 });
  }
}
