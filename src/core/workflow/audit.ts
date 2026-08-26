import { createHash } from "node:crypto";

export const AUDIT_DOMAIN = "signlatch:audit:v1";
export const AUDIT_GENESIS = "0".repeat(64);

export type AuditEventInput = {
  eventId: string;
  workflowId: string;
  tenantId: string;
  type: string;
  actorId: string;
  actorRole: string;
  occurredAt: string;
  correlationIds?: Record<string, string>;
  reason?: string;
  beforeStateRef?: string;
  afterStateRef?: string;
  data: Record<string, unknown>;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

export function auditEventHash(previousHash: string, event: AuditEventInput): string {
  const canonical = JSON.stringify(stableValue(event));
  return createHash("sha256")
    .update(`${AUDIT_DOMAIN}\n${previousHash}\n${canonical}`, "utf8")
    .digest("hex");
}

export type AuditChainEntry = {
  previousHash: string;
  event: AuditEventInput;
  hash: string;
};

export function verifyAuditChain(entries: AuditChainEntry[]): boolean {
  let expectedPrevious = AUDIT_GENESIS;
  for (const entry of entries) {
    if (entry.previousHash !== expectedPrevious) return false;
    if (auditEventHash(entry.previousHash, entry.event) !== entry.hash) return false;
    expectedPrevious = entry.hash;
  }
  return true;
}

const REDACTED_KEYS = /^(?:authorization|clientsecret|documenttext|password|secret|token|webhooksecret)$/i;

export function redactAuditData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditData);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      REDACTED_KEYS.test(key) ? "[REDACTED]" : redactAuditData(entry),
    ]));
  }
  return value;
}
