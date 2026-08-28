import { createHash } from "node:crypto";
import type {
  ESignEnvelopeRequest,
  ESignResult,
  FoxitESignAdapter,
} from "./esign-adapter";

type Config = {
  baseUrl: string;
  envelopePath: string;
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
  detailsPath?: string;
  activityPath?: string;
  executedDocumentPath?: string;
  correlationPath?: string;
};

type FoxitFolderResponse = {
  folder?: { folderId?: string | number; custom_field1?: string; customField1?: string };
  folderId?: string | number;
  custom_field1?: string;
  customField1?: string;
  result?: unknown;
  error_description?: unknown;
};

export class FoxitESignClient implements FoxitESignAdapter {
  constructor(
    private readonly config: Config,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    assertConfig(config);
  }

  async createEnvelope(input: ESignEnvelopeRequest): Promise<ESignResult> {
    let payload: ReturnType<typeof toCreateFolderPayload>;
    try {
      payload = toCreateFolderPayload(input);
    } catch {
      return { status: "denied", errorCode: "local-request-invalid", diagnostic: { phase: "local-validation", code: "payload-invalid" } };
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 15_000,
    );

    try {
      const response = await this.fetcher(
        new URL(this.config.envelopePath, this.config.baseUrl),
        {
          method: "POST",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            ...this.authHeaders(),
            "content-type": "application/json",
            "idempotency-key": input.idempotencyKey,
          },
          body: JSON.stringify(payload),
        },
      );
      const correlationId = response.headers.get("x-correlation-id") ?? undefined;
      const baseDiagnostic = { phase: "response" as const, code: `http-${response.status}`, httpStatus: response.status, contentType: safeContentType(response.headers.get("content-type")) };
      const bounded = await readBoundedText(response, 64 * 1024);
      const diagnostic = bounded.truncated
        ? { ...baseDiagnostic, phase: "protocol" as const, code: "response-too-large", responseBytes: bounded.bytes }
        : responseFingerprint(bounded.text, response.headers.get("content-type"), response.status);
      if (response.status >= 300 && response.status < 400) {
        return { status: "ambiguous", correlationId, diagnostic: { ...diagnostic, phase: "protocol", code: "redirect-rejected" } };
      }
      if (response.status === 429) {
        return {
          status: "safe-retry",
          errorCode: "rate-limited",
          retryAfterMs: retryAfterMs(response.headers.get("retry-after")),
          diagnostic,
        };
      }
      if (response.status >= 500) return { status: "ambiguous", correlationId, diagnostic };
      if (!response.ok) {
        return { status: "denied", errorCode: `foxit-http-${response.status}`, diagnostic };
      }
      if (bounded.truncated) {
        return { status: "ambiguous", correlationId, diagnostic };
      }
      const raw = bounded.text;
      let body: FoxitFolderResponse;
      try {
        body = JSON.parse(raw) as FoxitFolderResponse;
      } catch {
        return { status: "ambiguous", correlationId, diagnostic: { ...diagnostic, phase: "parse", code: "invalid-json" } };
      }
      const folderId = providerEnvelopeId(body.folder?.folderId ?? body.folderId);
      if (!folderId && (body.result === "error" || typeof body.error_description === "string")) {
        return {
          status: "denied",
          errorCode: "foxit-result-error",
          diagnostic: {
            ...diagnostic,
            phase: "response",
            code: "provider-result-error",
            responseKeys: safeKeys(body),
          },
        };
      }
      return folderId
        ? {
            status: "sent",
            providerEnvelopeId: folderId,
            correlationId,
          }
        : { status: "ambiguous", correlationId, diagnostic: { ...diagnostic, phase: "protocol", code: "missing-folder-id", responseKeys: safeKeys(body) } };
    } catch (error) {
      return { status: "ambiguous", diagnostic: { phase: "request", code: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network-error" } };
    } finally {
      clearTimeout(timer);
    }
  }

  async findByCorrelation(
    idempotencyKey: string,
  ): Promise<{ providerEnvelopeId: string } | null> {
    if (!this.config.correlationPath) return null;
    const body = (await this.getJson(
      this.pathFor(this.config.correlationPath, idempotencyKey, "idempotencyKey"),
    )) as FoxitFolderResponse;
    const folderId = providerEnvelopeId(body.folder?.folderId ?? body.folderId);
    const matchedKey = body.folder?.custom_field1 ?? body.folder?.customField1 ?? body.custom_field1 ?? body.customField1;
    return folderId && matchedKey === idempotencyKey
      ? { providerEnvelopeId: folderId }
      : null;
  }

  async getEnvelopeDetails(envelopeId: string): Promise<Record<string, unknown>> {
    return this.getJson(this.pathFor(this.config.detailsPath, envelopeId));
  }

  async getActivityHistory(envelopeId: string): Promise<Record<string, unknown>> {
    return this.getJson(this.pathFor(this.config.activityPath, envelopeId));
  }

  async downloadExecutedDocument(envelopeId: string): Promise<Uint8Array> {
    const response = await this.fetcher(
      new URL(
        this.pathFor(this.config.executedDocumentPath, envelopeId),
        this.config.baseUrl,
      ),
      {
        headers: this.authHeaders(),
        redirect: "manual",
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
      },
    );
    if (response.status >= 300 && response.status < 400) throw new Error("Foxit redirect rejected");
    if (!response.ok) throw new Error("Executed document retrieval failed");
    const bounded = await readBoundedBytes(response, 10 * 1024 * 1024);
    if (!bounded.bytes.length || bounded.truncated) {
      throw new Error("Executed document size is invalid");
    }
    return bounded.bytes;
  }

  private authHeaders(): Record<string, string> {
    return {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    };
  }

  private pathFor(
    template: string | undefined,
    value: string,
    placeholder = "envelopeId",
  ) {
    if (
      !template ||
      !template.startsWith("/") ||
      template.startsWith("//") ||
      template.includes("\\") ||
      !template.includes(`{${placeholder}}`)
    ) {
      throw new Error("Foxit eSign retrieval path is not configured");
    }
    const path = template.replace(`{${placeholder}}`, encodeURIComponent(value));
    const url = new URL(path, this.config.baseUrl);
    if (url.origin !== new URL(this.config.baseUrl).origin) throw new Error("Foxit path changed provider origin");
    return path;
  }

  private async getJson(path: string): Promise<Record<string, unknown>> {
    const response = await this.fetcher(new URL(path, this.config.baseUrl), {
      headers: this.authHeaders(),
      redirect: "manual",
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
    });
    if (response.status >= 300 && response.status < 400) throw new Error("Foxit redirect rejected");
    if (!response.ok) throw new Error("Foxit eSign retrieval failed");
    const bounded = await readBoundedText(response, 256 * 1024);
    if (bounded.truncated) throw new Error("Foxit eSign response is too large");
    const value: unknown = JSON.parse(bounded.text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Foxit eSign response is invalid");
    return value as Record<string, unknown>;
  }
}

function responseFingerprint(raw: string, contentType: string | null, httpStatus: number) {
  return { phase: "response" as const, code: `http-${httpStatus}`, httpStatus, contentType: safeContentType(contentType), responseBytes: Buffer.byteLength(raw), responseSha256: createHash("sha256").update(raw).digest("hex") };
}

async function readBoundedText(response: Response, limit: number): Promise<{ text: string; bytes: number; truncated: boolean }> {
  const bounded = await readBoundedBytes(response, limit);
  return { text: new TextDecoder().decode(bounded.bytes), bytes: bounded.byteCount, truncated: bounded.truncated };
}

async function readBoundedBytes(response: Response, limit: number): Promise<{ bytes: Uint8Array; byteCount: number; truncated: boolean }> {
  if (!response.body) return { bytes: new Uint8Array(), byteCount: 0, truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      return { bytes: new Uint8Array(), byteCount: bytes, truncated: true };
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return { bytes: combined, byteCount: bytes, truncated: false };
}

function safeContentType(value: string | null): string | undefined {
  return value?.split(";", 1)[0]?.trim().toLowerCase().slice(0, 64) || undefined;
}

function safeKeys(value: unknown): string[] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const allowed = new Set(["folder", "folderId", "result", "error", "errorCode", "error_description", "message"]);
  return Object.keys(value).filter((key) => allowed.has(key)).sort();
}

function providerEnvelopeId(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value);
  return /^[A-Za-z0-9._:-]{1,128}$/.test(normalized) ? normalized : undefined;
}

export function foxitESignConfigFromEnv(): Config {
  return {
    baseUrl: required("FOXIT_ESIGN_BASE_URL"),
    envelopePath: required("FOXIT_ESIGN_ENVELOPE_PATH"),
    clientId: required("FOXIT_ESIGN_CLIENT_ID"),
    clientSecret: required("FOXIT_ESIGN_CLIENT_SECRET"),
    detailsPath: process.env.FOXIT_ESIGN_DETAILS_PATH,
    activityPath: process.env.FOXIT_ESIGN_ACTIVITY_PATH,
    executedDocumentPath: process.env.FOXIT_ESIGN_EXECUTED_DOCUMENT_PATH,
    correlationPath: process.env.FOXIT_ESIGN_CORRELATION_PATH,
  };
}

function toCreateFolderPayload(input: ESignEnvelopeRequest) {
  return {
    folderName: input.subject,
    inputType: "base64",
    fileNames: ["approved-agreement.pdf"],
    base64FileString: [input.documentBase64],
    processTextTags: false,
    processAcroFields: false,
    parties: input.recipients.map((recipient) => {
      const { firstName, lastName } = splitName(recipient.name);
      return {
        firstName,
        lastName,
        emailId: recipient.email,
        permission: "FILL_FIELDS_AND_SIGN",
        sequence: recipient.order,
      };
    }),
    fields: input.fields.map((field, index) => ({
      type: "signature",
      x: field.x,
      y: field.y,
      width: 120,
      height: 40,
      documentNumber: 1,
      pageNumber: field.page,
      tabOrder: index + 1,
      party: partyNumber(input, field.recipientEmail),
      required: true,
    })),
    sendNow: true,
    createEmbeddedSigningSession: false,
    custom_field1: input.idempotencyKey,
  };
}

function partyNumber(input: ESignEnvelopeRequest, email: string): number {
  const index = input.recipients.findIndex((recipient) => recipient.email === email);
  if (index < 0) throw new Error("Foxit field recipient is missing");
  return index + 1;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName: firstName || "Signer", lastName: rest.join(" ") || "Signer" };
}

function retryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertConfig(config: Config) {
  const base = new URL(config.baseUrl);
  if (base.protocol !== "https:" || base.username || base.password) {
    throw new Error("Foxit eSign base URL must be credential-free HTTPS");
  }
  if (!config.envelopePath.startsWith("/")) {
    throw new Error("Foxit paths must be absolute paths");
  }
  for (const path of [config.envelopePath, config.detailsPath, config.activityPath, config.executedDocumentPath, config.correlationPath]) {
    if (path && (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))) throw new Error("Foxit paths must stay on the provider origin");
  }
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Foxit eSign credentials are required");
  }
}
