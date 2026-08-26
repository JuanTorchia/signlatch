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
  | { status: "safe-retry"; errorCode: "rate-limited" | "provider-unavailable"; retryAfterMs?: number }
  | { status: "denied"; errorCode: string }
  | { status: "ambiguous"; correlationId?: string };

export interface FoxitESignAdapter {
  createEnvelope(request: ESignEnvelopeRequest): Promise<ESignResult>;
  findByCorrelation(idempotencyKey: string): Promise<{ providerEnvelopeId: string } | null>;
}

export function redactESignError(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return { error: "provider-error" };
  const record = value as Record<string, unknown>;
  return { status: typeof record.status === "number" ? record.status : undefined,
    code: typeof record.code === "string" ? record.code.slice(0, 64) : "provider-error",
    correlationId: typeof record.correlationId === "string" ? record.correlationId.slice(0, 128) : undefined };
}
