export type ESignEnvelopeRequest = {
  idempotencyKey: string;
  approvalDigest: string;
  documentSha256: string;
  documentBase64: string;
  recipients: Array<{ name: string; email: string; order: number }>;
  fields: Array<{ recipientEmail: string; page: number; x: number; y: number }>;
  subject: string;
  message: string;
};

export type ESignResult =
  | { status: "sent"; providerEnvelopeId: string; correlationId?: string }
  | { status: "safe-retry"; errorCode: "rate-limited" | "provider-unavailable"; retryAfterMs?: number; diagnostic?: ProviderDiagnostic }
  | { status: "denied"; errorCode: string; diagnostic?: ProviderDiagnostic }
  | { status: "ambiguous"; correlationId?: string; diagnostic: ProviderDiagnostic };

export type ProviderDiagnostic = {
  phase: "local-validation" | "request" | "response" | "parse" | "protocol";
  code: string;
  httpStatus?: number;
  contentType?: string;
  responseBytes?: number;
  responseSha256?: string;
  responseKeys?: string[];
};

export interface FoxitESignAdapter {
  createEnvelope(request: ESignEnvelopeRequest): Promise<ESignResult>;
  findByCorrelation(idempotencyKey: string): Promise<{ providerEnvelopeId: string } | null>;
}

const DIAGNOSTIC_PHASES = new Set<ProviderDiagnostic["phase"]>([
  "local-validation", "request", "response", "parse", "protocol",
]);

export function sanitizeProviderDiagnostic(value: unknown): ProviderDiagnostic | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (!DIAGNOSTIC_PHASES.has(record.phase as ProviderDiagnostic["phase"])) return undefined;
  if (typeof record.code !== "string" || !/^[a-z0-9-]{1,64}$/.test(record.code)) return undefined;
  const diagnostic: ProviderDiagnostic = { phase: record.phase as ProviderDiagnostic["phase"], code: record.code };
  if (Number.isInteger(record.httpStatus) && Number(record.httpStatus) >= 100 && Number(record.httpStatus) <= 599) diagnostic.httpStatus = Number(record.httpStatus);
  if (typeof record.contentType === "string" && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(record.contentType)) diagnostic.contentType = record.contentType.slice(0, 64);
  if (Number.isInteger(record.responseBytes) && Number(record.responseBytes) >= 0 && Number(record.responseBytes) <= 10 * 1024 * 1024 + 1) diagnostic.responseBytes = Number(record.responseBytes);
  if (typeof record.responseSha256 === "string" && /^[a-f0-9]{64}$/.test(record.responseSha256)) diagnostic.responseSha256 = record.responseSha256;
  if (Array.isArray(record.responseKeys)) {
    const allowed = new Set(["folder", "folderId", "result", "error", "errorCode", "error_description", "message"]);
    diagnostic.responseKeys = record.responseKeys.filter((key): key is string => typeof key === "string" && allowed.has(key)).slice(0, 6);
  }
  return diagnostic;
}

export function redactESignError(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return { error: "provider-error" };
  const record = value as Record<string, unknown>;
  return { status: typeof record.status === "number" ? record.status : undefined,
    code: typeof record.code === "string" ? record.code.slice(0, 64) : "provider-error",
    correlationId: typeof record.correlationId === "string" ? record.correlationId.slice(0, 128) : undefined };
}
