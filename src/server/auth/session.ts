import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type SessionRole = "operator" | "approver" | "dispatcher" | "auditor";
export type SessionClaims = {
  principalId: string;
  tenantId: string;
  roles: SessionRole[];
  authenticatedAt: number;
  expiresAt: number;
};

export function issueSession(claims: SessionClaims, secret: string): string {
  assertSecret(secret);
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function parseSession(token: string, secret: string, now = Date.now()): SessionClaims | null {
  try {
    assertSecret(secret);
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = sign(payload, secret);
    if (!safeEqual(signature, expected)) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (!isSessionClaims(value) || value.expiresAt < now) return null;
    return value;
  } catch {
    return null;
  }
}

export function createCsrfToken(sessionId: string, secret: string): string {
  assertSecret(secret);
  const nonce = randomBytes(16).toString("base64url");
  return `${nonce}.${sign(`csrf:${sessionId}:${nonce}`, secret)}`;
}

export function verifyCsrfToken(token: string, sessionId: string, secret: string): boolean {
  const [nonce, signature, extra] = token.split(".");
  if (!nonce || !signature || extra) return false;
  return safeEqual(signature, sign(`csrf:${sessionId}:${nonce}`, secret));
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function assertSecret(secret: string): void {
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("Session secret must be at least 32 bytes");
}

function isSessionClaims(value: unknown): value is SessionClaims {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const validRoles = new Set(["operator", "approver", "dispatcher", "auditor"]);
  return typeof record.principalId === "string"
    && typeof record.tenantId === "string"
    && Array.isArray(record.roles)
    && record.roles.every((role) => typeof role === "string" && validRoles.has(role))
    && typeof record.authenticatedAt === "number"
    && typeof record.expiresAt === "number";
}
