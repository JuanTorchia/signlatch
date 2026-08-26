import { createHash, randomUUID } from "node:crypto";

import { requireCurrentCapability } from "@/server/auth/authorize";
import {
  requireRequestCsrf,
  sessionFromRequest,
  sessionTokenFromRequest,
} from "@/server/auth/request-session";
import { database } from "@/server/database";
import { artifactRootFromEnv, FilesystemArtifactStore } from "@/server/artifacts/filesystem-store";
import { FoxitStdioMcpClient, foxitMcpConfigFromEnv } from "@/server/foxit/mcp-client";
import { prepareTextPdf } from "@/server/foxit/prepare-text-pdf";
import { BodyLimitError, readBoundedBody } from "@/server/http/bounded-body";
import { ProviderOperations } from "@/server/workflow/provider-operations";
import type { ProviderOperationLease } from "@/server/workflow/provider-operations";
import { SecurityStore } from "@/server/workflow/security-store";

export async function POST(request: Request) {
  if (process.env.SIGNLATCH_DEMO_ENABLED !== "true") {
    return Response.json({ error: "The Foxit preparation demo is disabled" }, { status: 503 });
  }
  let operationId: string | undefined;
  let operations: ProviderOperations | undefined;
  let operationLease: ProviderOperationLease | undefined;
  try {
    const bytes = await readBoundedBody(request, 64 * 1024);
    const sessionToken = sessionTokenFromRequest(request);
    const session = sessionFromRequest(request);
    requireRequestCsrf(request, sessionToken);
    const sql = database();
    const security = new SecurityStore(sql);
    await requireCurrentCapability(security, session, "prepare");
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      return Response.json({ error: "A valid Idempotency-Key is required" }, { status: 400 });
    }
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null || !("prompt" in body)) {
      return Response.json({ error: "A document prompt is required" }, { status: 400 });
    }
    const prompt = (body as { prompt?: unknown }).prompt;
    if (typeof prompt !== "string") {
      return Response.json({ error: "Document prompt must be text" }, { status: 400 });
    }

    operations = new ProviderOperations(sql);
    const reservation = await operations.reserve({
      tenantId: session.tenantId,
      kind: "pdf-prepare",
      idempotencyKey,
      requestDigest: createHash("sha256").update(bytes).digest("hex"),
      now: new Date(),
    });
    operationId = reservation.operationId;
    if (reservation.existing) {
      return Response.json({ operationId, status: reservation.state }, { status: 202 });
    }
    const started = await operations.start(operationId, `web:${randomUUID()}`, new Date());
    if (!started) return Response.json({ operationId, status: "reserved" }, { status: 202 });
    operationLease = started;

    const result = await prepareTextPdf(
      prompt,
      new FoxitStdioMcpClient(foxitMcpConfigFromEnv()),
      new FilesystemArtifactStore(artifactRootFromEnv()),
    );
    await security.registerArtifact({
      tenantId: session.tenantId,
      sha256: result.artifact.sha256,
      storageKey: result.artifact.storageKey,
      actualSize: result.artifact.size,
      retentionDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await operations.succeed(operationLease, result.artifact.sha256, {
      artifact: result.artifact,
      manifest: result.manifest,
    });
    return Response.json({
      operationId,
      artifact: {
        ...result.artifact,
        url: `/api/artifacts/${result.artifact.sha256}`,
      },
      manifest: result.manifest,
      authority: { signingEnabled: false, reason: "Preparation never grants approval or dispatch authority" },
    });
  } catch (error) {
    if (operationLease && operations) await operations.reconcile(operationLease).catch(() => undefined);
    if (error instanceof BodyLimitError) {
      return Response.json({ error: "Request is too large" }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Foxit preparation failed";
    const safeMessage = /prompt|PDF|Foxit MCP|configuration|timeout|already/i.test(message)
      ? message
      : "Foxit preparation failed safely";
    return Response.json({ error: safeMessage }, { status: 400 });
  }
}
