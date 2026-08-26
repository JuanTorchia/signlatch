import type { AgreementIntent } from "../../src/core/agreement/intent";

export function completeAgreementFixture(): AgreementIntent {
  return {
    schema: "signlatch.agreement-intent.v1",
    buyer: { name: "Acme Procurement" },
    supplier: { name: "Example Components Ltd." },
    paymentTerms: "Net 30",
    liabilityCap: "USD 50,000",
    governingLaw: "Delaware",
    signers: [{ id: "buyer-signer", name: "Alex Buyer", email: "alex@example.invalid", role: "buyer" }],
    clauses: ["confidentiality", "termination"],
    unresolvedFacts: [],
    sourceRequestSha256: "a".repeat(64),
  };
}
