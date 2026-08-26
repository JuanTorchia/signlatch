export const PUBLIC_SHOWCASE = Object.freeze({
  status: "fixture-demonstrated" as const,
  capturedAt: "2026-08-25T00:00:00.000Z",
  request: "Prepare a supplier agreement for Example Components with Net 30 terms.",
  artifactSha256: "8f0b2b32d4a1f6c6b90a09caa36438f74d46bc62d5f726d42a2cc9bb3e7b1301",
  recipient: "alex@example.invalid",
  findings: ["Human approval is required", "Signing dispatch is latched"],
  provenance: ["upload_document", "pdf_from_text", "download_document"],
  signingEnabled: false,
  externalEffects: false,
});
