import { createHash } from "node:crypto";

import type { AgreementIntent } from "./intent";
import type { PolicyFinding } from "./policy";

export type ReviewInput = {
  workflowId: string;
  intent: AgreementIntent;
  artifactSha256: string;
  recipients: Array<{ id: string; email: string; order: number }>;
  fields: Array<{ id: string; recipientId: string; page: number; rectangle: [number, number, number, number] }>;
  findings: PolicyFinding[];
  provenanceSha256: string;
};

export type ReviewSnapshot = { input: ReviewInput; digest: string };

export function createReviewSnapshot(input: ReviewInput): ReviewSnapshot {
  const canonicalInput = canonicalize(input) as ReviewInput;
  return {
    input: canonicalInput,
    digest: createHash("sha256").update(`signlatch:review:v1\n${JSON.stringify(canonicalInput)}`, "utf8").digest("hex"),
  };
}

export function diffReviewSnapshots(before: ReviewSnapshot, after: ReviewSnapshot) {
  const diffs: Array<{ category: string; before: unknown; after: unknown }> = [];
  const keys: Array<[string, keyof ReviewInput]> = [
    ["artifact", "artifactSha256"], ["intent", "intent"], ["recipients", "recipients"],
    ["fields", "fields"], ["findings", "findings"], ["provenance", "provenanceSha256"],
  ];
  for (const [category, key] of keys) {
    if (JSON.stringify(before.input[key]) !== JSON.stringify(after.input[key])) {
      diffs.push({ category, before: before.input[key], after: after.input[key] });
    }
  }
  return diffs;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}
