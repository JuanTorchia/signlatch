import { createHash } from "node:crypto";

export const APPROVAL_V2_DOMAIN = "signlatch:exact-approval:v2";

export type ExactApprovalV2 = {
  schema: "signlatch.exact-approval.v2";
  tenantId: string;
  workflowId: string;
  reviewVersion: number;
  reviewDigest: string;
  approverId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

function canonicalize(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFKC");
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

export function validateExactApproval(value: ExactApprovalV2): void {
  if (value.schema !== "signlatch.exact-approval.v2") throw new Error("Unsupported approval schema");
  if (!Number.isInteger(value.reviewVersion) || value.reviewVersion < 1) throw new Error("Review version is invalid");
  if (!/^[a-f0-9]{64}$/.test(value.reviewDigest)) throw new Error("Review digest is invalid");
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(value.nonce)) throw new Error("Approval nonce is invalid");
  const issued = Date.parse(value.issuedAt);
  const expires = Date.parse(value.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) throw new Error("Approval expiry is invalid");
}

export function canonicalExactApproval(value: ExactApprovalV2): string {
  validateExactApproval(value);
  return JSON.stringify(canonicalize(value));
}

export function exactApprovalDigest(value: ExactApprovalV2): string {
  return createHash("sha256").update(`${APPROVAL_V2_DOMAIN}\n${canonicalExactApproval(value)}`, "utf8").digest("hex");
}

export function assertExactApprovalFresh(value: ExactApprovalV2, now: Date): void {
  if (now.getTime() >= Date.parse(value.expiresAt)) throw new Error("Approval has expired");
}
