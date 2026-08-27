import assert from "node:assert/strict";
import test from "node:test";

import {
  PdfValidationError,
  qpdfReportsEncryption,
  SandboxedPdfValidator,
  type PdfParserRunner,
} from "../src/server/artifacts/pdf-validator";

const minimalPdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj<<>>endobj\nstartxref\n9\n%%EOF\n");

test("distinguishes qpdf's unencrypted status from encrypted input", () => {
  assert.equal(qpdfReportsEncryption("File is not encrypted\n1\nNo syntax errors"), false);
  assert.equal(qpdfReportsEncryption("File is encrypted\n1\nNo syntax errors"), true);
});

test("accepts a structurally valid bounded PDF", async () => {
  const runner: PdfParserRunner = async () => ({ valid: true, encrypted: false, pages: 1, outputBytes: 32 });
  const result = await new SandboxedPdfValidator(runner).validate(minimalPdf);
  assert.equal(result.pages, 1);
});

test("rejects encrypted, polyglot, truncated, and resource-heavy parser results", async () => {
  const cases: Array<Parameters<PdfParserRunner>[0] extends never ? never : Awaited<ReturnType<PdfParserRunner>>> = [
    { valid: true, encrypted: true, pages: 1, outputBytes: 10 },
    { valid: false, encrypted: false, pages: 0, outputBytes: 10, reason: "truncated" },
    { valid: true, encrypted: false, pages: 1, outputBytes: 300_000 },
  ];
  for (const result of cases) {
    const validator = new SandboxedPdfValidator(async () => result);
    await assert.rejects(validator.validate(minimalPdf), PdfValidationError);
  }
});

test("rejects trailing polyglot bytes before the parser boundary", async () => {
  const bytes = new TextEncoder().encode(`${new TextDecoder().decode(minimalPdf)}<script>`);
  const validator = new SandboxedPdfValidator(async () => ({ valid: true, encrypted: false, pages: 1, outputBytes: 10 }));
  await assert.rejects(validator.validate(bytes), /trailing content/);
});
