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
  folder?: { folderId?: string | number };
  folderId?: string | number;
};

export class FoxitESignClient implements FoxitESignAdapter {
  constructor(
    private readonly config: Config,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    assertConfig(config);
  }

  async createEnvelope(input: ESignEnvelopeRequest): Promise<ESignResult> {
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
          signal: controller.signal,
          headers: {
            ...this.authHeaders(),
            "content-type": "application/json",
            "idempotency-key": input.idempotencyKey,
          },
          body: JSON.stringify(toCreateFolderPayload(input)),
        },
      );
      const correlationId = response.headers.get("x-correlation-id") ?? undefined;
      if (response.status === 429) {
        return {
          status: "safe-retry",
          errorCode: "rate-limited",
          retryAfterMs: retryAfterMs(response.headers.get("retry-after")),
        };
      }
      if (response.status >= 500) return { status: "ambiguous", correlationId };
      if (!response.ok) {
        return { status: "denied", errorCode: `foxit-http-${response.status}` };
      }

      const body = (await response.json()) as FoxitFolderResponse;
      const folderId = body.folder?.folderId ?? body.folderId;
      return folderId !== undefined && String(folderId)
        ? {
            status: "sent",
            providerEnvelopeId: String(folderId),
            correlationId,
          }
        : { status: "ambiguous", correlationId };
    } catch {
      return { status: "ambiguous" };
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
    const folderId = body.folder?.folderId ?? body.folderId;
    return folderId !== undefined && String(folderId)
      ? { providerEnvelopeId: String(folderId) }
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
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
      },
    );
    if (!response.ok) throw new Error("Executed document retrieval failed");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
      throw new Error("Executed document size is invalid");
    }
    return bytes;
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
      !template.includes(`{${placeholder}}`)
    ) {
      throw new Error("Foxit eSign retrieval path is not configured");
    }
    return template.replace(`{${placeholder}}`, encodeURIComponent(value));
  }

  private async getJson(path: string): Promise<Record<string, unknown>> {
    const response = await this.fetcher(new URL(path, this.config.baseUrl), {
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
    });
    if (!response.ok) throw new Error("Foxit eSign retrieval failed");
    return (await response.json()) as Record<string, unknown>;
  }
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
    metadata: JSON.stringify({
      approvalDigest: input.approvalDigest,
      documentSha256: input.documentSha256,
    }),
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
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
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
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Foxit eSign credentials are required");
  }
}
