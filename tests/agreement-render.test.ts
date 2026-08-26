import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAgreementPolicy } from "../src/core/agreement/policy";
import { renderAgreementText } from "../src/core/agreement/render";
import { completeAgreementFixture } from "./fixtures/agreement";

test("rendering is deterministic and carries exact structured facts", () => {
  const intent = completeAgreementFixture();
  const first = renderAgreementText(intent);
  assert.equal(first, renderAgreementText(structuredClone(intent)));
  assert.match(first, /Example Components Ltd\./);
  assert.match(first, /Net 30/);
  assert.match(first, /USD 50,000/);
  assert.match(first, /DRAFT — HUMAN APPROVAL REQUIRED/);
});

test("policy findings are deterministic and require acknowledgement", () => {
  const intent = completeAgreementFixture();
  intent.governingLaw = undefined;
  const findings = evaluateAgreementPolicy(intent);
  assert.ok(findings.some((finding) => finding.ruleId === "governing-law-missing"));
  assert.ok(findings.every((finding) => finding.rulesetVersion === "supplier-v1"));
});
