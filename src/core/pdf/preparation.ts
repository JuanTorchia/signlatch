import { createHash } from "node:crypto";

export const FOXIT_PREPARATION_TOOLS = [
  "upload_document",
  "pdf_from_text",
  "download_document",
] as const;

export type FoxitPreparationTool = (typeof FOXIT_PREPARATION_TOOLS)[number];

export type ToolCall = {
  name: FoxitPreparationTool;
  arguments: Record<string, unknown>;
};

export type ToolResult = {
  success: true;
  documentId?: string;
  resultDocumentId?: string;
  taskId?: string;
  outputPath?: string;
  size?: number;
};

export interface PdfToolCaller {
  call(call: ToolCall): Promise<ToolResult>;
  scheduleRemoteCleanup?(documentIds: string[], deadline: Date): Promise<void>;
  close?(): Promise<void>;
}

export type ArtifactRecord = {
  id: string;
  sha256: string;
  size: number;
  mediaType: "application/pdf";
  storageKey: string;
};

export interface ImmutableArtifactStore {
  putPdf(bytes: Uint8Array): Promise<ArtifactRecord>;
  putManifest?(manifest: ProvenanceManifest): Promise<string>;
}

export type ProvenanceEntry = {
  sequence: number;
  tool: FoxitPreparationTool;
  argumentsDigest: string;
  inputDocumentId?: string;
  outputDocumentId?: string;
  taskId?: string;
};

export type PreparedPdf = {
  artifact: ArtifactRecord;
  provenance: ProvenanceEntry[];
  manifest: ProvenanceManifest;
};

export type ProvenanceManifest = {
  schema: "signlatch.foxit-provenance.v1";
  recordedAt: string;
  artifactSha256: string;
  calls: ProvenanceEntry[];
  manifestSha256: string;
};

const MAX_PROMPT_BYTES = 32_000;

export function validateDocumentPrompt(prompt: string): string {
  const normalized = prompt.replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new Error("Document prompt must not be empty");
  if (Buffer.byteLength(normalized, "utf8") > MAX_PROMPT_BYTES) {
    throw new Error(`Document prompt exceeds ${MAX_PROMPT_BYTES} bytes`);
  }
  if (/\u0000/.test(normalized)) throw new Error("Document prompt contains a null byte");
  return normalized;
}

export function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function assertPreparationTool(name: string): asserts name is FoxitPreparationTool {
  if (!(FOXIT_PREPARATION_TOOLS as readonly string[]).includes(name)) {
    throw new Error(`Foxit tool is outside the preparation allowlist: ${name}`);
  }
}

export function digestToolArguments(argumentsValue: Record<string, unknown>): string {
  return sha256(`signlatch:foxit-arguments:v1\n${canonicalJson(argumentsValue)}`);
}

export function createProvenanceManifest(
  artifactSha256: string,
  calls: ProvenanceEntry[],
  recordedAt = new Date().toISOString(),
): ProvenanceManifest {
  const unsigned = {
    schema: "signlatch.foxit-provenance.v1" as const,
    recordedAt,
    artifactSha256,
    calls,
  };
  return {
    ...unsigned,
    manifestSha256: sha256(`signlatch:foxit-provenance:v1\n${canonicalJson(unsigned)}`),
  };
}

function canonicalJson(value: unknown): string {
  const normalize = (entry: unknown): unknown => {
    if (typeof entry === "string") return entry.normalize("NFKC");
    if (Array.isArray(entry)) return entry.map(normalize);
    if (entry !== null && typeof entry === "object") {
      return Object.fromEntries(
        Object.entries(entry)
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([key, nested]) => [key, normalize(nested)]),
      );
    }
    return entry;
  };
  return JSON.stringify(normalize(value));
}
