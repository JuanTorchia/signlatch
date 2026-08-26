import type { AgreementIntent } from "./intent";

export type PolicyFinding = {
  ruleId: string;
  rulesetVersion: "supplier-v1";
  severity: "info" | "warning" | "block";
  message: string;
  acknowledgementRequired: boolean;
};

export function evaluateAgreementPolicy(intent: AgreementIntent): PolicyFinding[] {
  const findings: PolicyFinding[] = [];
  if (!intent.governingLaw) findings.push(finding("governing-law-missing", "warning", "Governing law is not specified."));
  if (intent.unresolvedFacts.length) findings.push(finding("material-facts-unresolved", "block", "Material agreement facts remain unresolved."));
  findings.push(finding("human-approval-required", "info", "A human must approve the exact review snapshot before dispatch."));
  return findings.sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

function finding(ruleId: string, severity: PolicyFinding["severity"], message: string): PolicyFinding {
  return {
    ruleId,
    rulesetVersion: "supplier-v1",
    severity,
    message,
    acknowledgementRequired: severity !== "info",
  };
}
