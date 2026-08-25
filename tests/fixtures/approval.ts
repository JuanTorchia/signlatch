import { documentDigest, type ApprovalEnvelopeV1 } from "../../src/core/approval/envelope";

export const documentBytes = new TextEncoder().encode("supplier agreement v1");

export function approvalFixture(): ApprovalEnvelopeV1 {
  return {
    schema: "signlatch.approval.v1",
    tenantId: "tenant-acme",
    workflowId: "supplier-onboarding-42",
    approvalId: "approval-001",
    approverId: "user-procurement-lead",
    documentSha256: documentDigest(documentBytes),
    recipients: [
      {
        email: "supplier@example.com",
        name: "Supplier Signer",
        role: "signer",
        order: 1,
        authentication: "email",
      },
    ],
    fields: [
      {
        id: "supplier-signature",
        recipientEmail: "supplier@example.com",
        type: "signature",
        page: 3,
        x: 96,
        y: 640,
      },
    ],
    delivery: {
      subject: "Supplier agreement for signature",
      message: "Please review and sign the attached agreement.",
    },
    policyRulesetSha256: "a".repeat(64),
    provider: "foxit-esign",
    providerAccountId: "foxit-account-production",
    createdAt: "2026-08-25T12:00:00.000Z",
    expiresAt: "2026-08-25T12:15:00.000Z",
  };
}
