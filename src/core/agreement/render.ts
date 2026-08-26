import type { AgreementIntent } from "./intent";

export function renderAgreementText(intent: AgreementIntent): string {
  return [
    "SUPPLIER AGREEMENT",
    "DRAFT — HUMAN APPROVAL REQUIRED",
    "",
    `Buyer: ${intent.buyer.name}`,
    `Supplier: ${intent.supplier.name}`,
    `Payment terms: ${intent.paymentTerms}`,
    `Liability cap: ${intent.liabilityCap}`,
    `Governing law: ${intent.governingLaw ?? "UNRESOLVED"}`,
    `Clauses: ${[...intent.clauses].sort().join(", ") || "None selected"}`,
    "",
    "Authorized signers:",
    ...[...intent.signers]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((signer) => `- ${signer.name} <${signer.email}> (${signer.role})`),
    "",
    "This document is a workflow draft, not legal advice. It cannot be sent for",
    "signature until a human approves the exact artifact, recipients, fields, and findings.",
  ].join("\n");
}
