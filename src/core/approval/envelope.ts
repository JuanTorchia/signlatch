import { createHash } from "node:crypto";

export const APPROVAL_DOMAIN = "signlatch:approval:v1";

export type Recipient = {
  email: string;
  name: string;
  role: "signer" | "approver" | "cc";
  order: number;
  authentication: "email" | "sms" | "knowledge-based";
};

export type SignerField = {
  id: string;
  recipientEmail: string;
  type: "signature" | "initials" | "date" | "text";
  page: number;
  x: number;
  y: number;
};

export type ApprovalEnvelopeV1 = {
  schema: "signlatch.approval.v1";
  tenantId: string;
  workflowId: string;
  approvalId: string;
  approverId: string;
  documentSha256: string;
  recipients: Recipient[];
  fields: SignerField[];
  delivery: {
    subject: string;
    message: string;
  };
  policyRulesetSha256: string;
  provider: "foxit-esign";
  providerAccountId: string;
  createdAt: string;
  expiresAt: string;
};

function normalizeString(value: string): string {
  return value.normalize("NFKC");
}

function canonicalize(value: unknown): unknown {
  if (typeof value === "string") {
    return normalizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }

  return value;
}

function assertSha256(value: string, field: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${field} must be a lowercase SHA-256 digest`);
  }
}

export function validateApprovalEnvelope(envelope: ApprovalEnvelopeV1): void {
  assertSha256(envelope.documentSha256, "documentSha256");
  assertSha256(envelope.policyRulesetSha256, "policyRulesetSha256");

  const createdAt = Date.parse(envelope.createdAt);
  const expiresAt = Date.parse(envelope.expiresAt);
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= createdAt) {
    throw new Error("Approval expiry must be later than creation time");
  }

  const recipientEmails = envelope.recipients.map((recipient) => recipient.email.toLowerCase());
  if (new Set(recipientEmails).size !== recipientEmails.length) {
    throw new Error("Recipient emails must be unique");
  }

  const orders = envelope.recipients.map((recipient) => recipient.order);
  if (orders.some((order) => !Number.isInteger(order) || order < 1)) {
    throw new Error("Recipient order must contain positive integers");
  }

  const recipientSet = new Set(recipientEmails);
  for (const field of envelope.fields) {
    if (!recipientSet.has(field.recipientEmail.toLowerCase())) {
      throw new Error(`Field ${field.id} references an unknown recipient`);
    }
  }
}

export function canonicalApprovalEnvelope(envelope: ApprovalEnvelopeV1): string {
  validateApprovalEnvelope(envelope);
  return JSON.stringify(canonicalize(envelope));
}

export function approvalDigest(envelope: ApprovalEnvelopeV1): string {
  const payload = `${APPROVAL_DOMAIN}\n${canonicalApprovalEnvelope(envelope)}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function documentDigest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isApprovalFresh(envelope: ApprovalEnvelopeV1, now: Date): boolean {
  return now.getTime() < Date.parse(envelope.expiresAt);
}
