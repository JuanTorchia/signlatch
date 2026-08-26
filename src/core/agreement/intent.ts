export type AgreementParty = { name: string };
export type AgreementSigner = {
  id: string;
  name: string;
  email: string;
  role: "buyer" | "supplier";
};

export type AgreementIntent = {
  schema: "signlatch.agreement-intent.v1";
  buyer: AgreementParty;
  supplier: AgreementParty;
  paymentTerms: string;
  liabilityCap: string;
  governingLaw?: string;
  signers: AgreementSigner[];
  clauses: string[];
  unresolvedFacts: string[];
  sourceRequestSha256: string;
};

export function validateAgreementIntent(intent: AgreementIntent): string[] {
  const errors = [...intent.unresolvedFacts];
  if (intent.schema !== "signlatch.agreement-intent.v1") errors.push("schema");
  if (!safeText(intent.buyer.name)) errors.push("buyer.name");
  if (!safeText(intent.supplier.name)) errors.push("supplier.name");
  if (!/^Net (?:15|30|45|60)$/.test(intent.paymentTerms)) errors.push("paymentTerms");
  if (!/^[A-Z]{3} [1-9][0-9,]*(?:\.[0-9]{2})?$/.test(intent.liabilityCap)) errors.push("liabilityCap");
  if (intent.signers.length < 1) errors.push("signers");
  const emails = new Set<string>();
  for (const signer of intent.signers) {
    const email = signer.email.normalize("NFC").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push(`signer.${signer.id}.email`);
    if (emails.has(email)) errors.push("signers.duplicate");
    emails.add(email);
  }
  return [...new Set(errors)];
}

function safeText(value: string): boolean {
  return value.trim().length > 0 && value.length <= 160 && !/[\u0000-\u001f]/.test(value);
}
