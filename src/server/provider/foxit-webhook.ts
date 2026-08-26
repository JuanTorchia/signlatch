import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type FoxitLifecycle =
  | "created"
  | "sent"
  | "viewed"
  | "signed"
  | "completed"
  | "executed"
  | "declined"
  | "cancelled";

export type FoxitWebhookEvent = {
  eventId: string;
  envelopeId: string;
  type: FoxitLifecycle;
  occurredAt: string;
};

const lifecycleByEventName: Record<string, FoxitLifecycle | undefined> = {
  folder_sent: "sent",
  folder_viewed: "viewed",
  folder_signed: "signed",
  folder_completed: "completed",
  folder_executed: "executed",
  folder_cancelled: "cancelled",
};

const DEFAULT_MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const DEFAULT_MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;

export function verifyFoxitWebhook(input: {
  rawBody: Uint8Array;
  signature: string;
  secrets: readonly string[];
  maxBytes?: number;
  nowMs?: number;
  maxEventAgeMs?: number;
  maxFutureSkewMs?: number;
}): FoxitWebhookEvent {
  if (
    !input.rawBody.length ||
    input.rawBody.length > (input.maxBytes ?? 1_048_576)
  ) {
    throw new Error("Webhook body size is invalid");
  }
  const supplied = parseSignature(input.signature);
  const valid = input.secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(input.rawBody).digest();
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  });
  if (!valid) throw new Error("Webhook signature is invalid");

  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(input.rawBody).toString("utf8"));
  } catch {
    throw new Error("Webhook JSON is malformed");
  }
  if (!value || typeof value !== "object") {
    throw new Error("Webhook event is invalid");
  }

  const record = value as Record<string, unknown>;
  const eventName = record.event_name;
  const eventDate = record.event_date;
  const data = asRecord(record.data);
  const folder = asRecord(data?.folder);
  const folderId = folder?.folderId;
  const type = typeof eventName === "string" ? lifecycleByEventName[eventName] : undefined;
  if (
    !type ||
    (typeof folderId !== "string" && typeof folderId !== "number") ||
    !String(folderId) ||
    typeof eventDate !== "number" ||
    !Number.isSafeInteger(eventDate) ||
    eventDate <= 0
  ) {
    throw new Error("Webhook event is invalid");
  }
  const nowMs = input.nowMs ?? Date.now();
  const maxEventAgeMs = input.maxEventAgeMs ?? DEFAULT_MAX_EVENT_AGE_MS;
  const maxFutureSkewMs = input.maxFutureSkewMs ?? DEFAULT_MAX_FUTURE_SKEW_MS;
  if (
    !Number.isSafeInteger(nowMs) ||
    !Number.isSafeInteger(maxEventAgeMs) ||
    maxEventAgeMs < 0 ||
    !Number.isSafeInteger(maxFutureSkewMs) ||
    maxFutureSkewMs < 0
  ) {
    throw new Error("Webhook freshness policy is invalid");
  }
  if (eventDate < nowMs - maxEventAgeMs || eventDate > nowMs + maxFutureSkewMs) {
    throw new Error("Webhook event timestamp is outside the accepted window");
  }
  const occurredAt = new Date(eventDate).toISOString();
  return {
    eventId: createHash("sha256").update(input.rawBody).digest("hex"),
    envelopeId: String(folderId),
    type,
    occurredAt,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseSignature(value: string): Buffer {
  if (
    !value ||
    value.length > 256 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value) ||
    value.length % 4 !== 0
  ) {
    throw new Error("Webhook signature is malformed");
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== value) {
    throw new Error("Webhook signature is malformed");
  }
  return decoded;
}
