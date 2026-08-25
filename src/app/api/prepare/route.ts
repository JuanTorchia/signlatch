import path from "node:path";

import { FilesystemArtifactStore } from "@/server/artifacts/filesystem-store";
import { FoxitStdioMcpClient, foxitMcpConfigFromEnv } from "@/server/foxit/mcp-client";
import { prepareTextPdf } from "@/server/foxit/prepare-text-pdf";

let preparationInProgress = false;

export async function POST(request: Request) {
  if (process.env.SIGNLATCH_DEMO_ENABLED !== "true") {
    return Response.json({ error: "The Foxit preparation demo is disabled" }, { status: 503 });
  }
  if (preparationInProgress) {
    return Response.json({ error: "A Foxit preparation is already running" }, { status: 429 });
  }

  preparationInProgress = true;
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 40_000) {
      return Response.json({ error: "Request is too large" }, { status: 413 });
    }
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("prompt" in body)) {
      return Response.json({ error: "A document prompt is required" }, { status: 400 });
    }
    const prompt = (body as { prompt?: unknown }).prompt;
    if (typeof prompt !== "string") {
      return Response.json({ error: "Document prompt must be text" }, { status: 400 });
    }

    const result = await prepareTextPdf(
      prompt,
      new FoxitStdioMcpClient(foxitMcpConfigFromEnv()),
      new FilesystemArtifactStore(path.join(process.cwd(), ".data", "artifacts")),
    );
    return Response.json({
      artifact: {
        ...result.artifact,
        url: `/api/artifacts/${result.artifact.sha256}`,
      },
      manifest: result.manifest,
      authority: { signingEnabled: false, reason: "Human approval is not implemented" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Foxit preparation failed";
    const safeMessage = /prompt|PDF|Foxit MCP|configuration|timeout|already/i.test(message)
      ? message
      : "Foxit preparation failed safely";
    return Response.json({ error: safeMessage }, { status: 400 });
  } finally {
    preparationInProgress = false;
  }
}
