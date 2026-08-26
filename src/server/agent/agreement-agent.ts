import { createHash } from "node:crypto";

import type { AgreementIntent, AgreementSigner } from "@/core/agreement/intent";

export function structureAgreementIntent(request: string): AgreementIntent {
  if (!/supplier agreement/i.test(request)) throw new Error("Only the supplier agreement workflow is supported");
  const buyer = capture(request, /\bbuyer\s*:?(?:\s+is)?\s*([^;,.]+(?:\s+[^;,.]+)*)/i);
  const supplier = capture(request, /\bsupplier(?!\s+agreement)(?:\s*:|\s+is|\s+)\s*([^;,]+)/i)
    ?? capture(request, /supplier agreement for\s+([^;,]+)/i);
  const payments = [...request.matchAll(/\bpayment\s*:?(?:\s+terms)?\s*(Net\s+(?:15|30|45|60))/gi)].map((match) => normalize(match[1]));
  const liability = capture(request, /\bliability cap\s*:?[\s]*(USD\s+[0-9,]+(?:\.[0-9]{2})?)/i);
  const signerMatch = request.match(/\bsigner\s*:?[\s]*([^;<]+)\s*<([^>]+)>/i);
  const signers: AgreementSigner[] = signerMatch ? [{
    id: "buyer-signer",
    name: normalize(signerMatch[1]),
    email: normalize(signerMatch[2]).toLowerCase(),
    role: "buyer",
  }] : [];
  const unresolvedFacts: string[] = [];
  if (!buyer) unresolvedFacts.push("buyer.name");
  if (!supplier) unresolvedFacts.push("supplier.name");
  if (!payments.length) unresolvedFacts.push("paymentTerms");
  if (new Set(payments).size > 1) unresolvedFacts.push("paymentTerms.conflict");
  if (!liability) unresolvedFacts.push("liabilityCap");
  if (!signers.length) unresolvedFacts.push("signers");
  return {
    schema: "signlatch.agreement-intent.v1",
    buyer: { name: buyer ?? "" },
    supplier: { name: supplier ?? "" },
    paymentTerms: payments.length === 1 ? payments[0] : "",
    liabilityCap: liability ?? "",
    governingLaw: capture(request, /\bgoverning law\s*:?[\s]*([^;,.]+)/i),
    signers,
    clauses: ["confidentiality", "termination"],
    unresolvedFacts,
    sourceRequestSha256: createHash("sha256").update(request.normalize("NFC"), "utf8").digest("hex"),
  };
}

function capture(source: string, pattern: RegExp): string | undefined {
  const value = source.match(pattern)?.[1];
  return value ? normalize(value) : undefined;
}

function normalize(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}
