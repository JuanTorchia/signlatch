import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SandboxedPdfValidator } from "../src/server/artifacts/pdf-validator";
import { FilesystemArtifactStore } from "../src/server/artifacts/filesystem-store";

const pdf = Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\nstartxref\n9\n%%EOF\n");

test("stored preparation bytes are rehashed and retained privately", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "signlatch-review-"));
  const validator = new SandboxedPdfValidator(async () => ({ valid: true, encrypted: false, pages: 1, outputBytes: 10 }));
  try {
    const store = new FilesystemArtifactStore(root, validator);
    const record = await store.putPdf(pdf);
    assert.equal(record.size, pdf.byteLength);
    assert.deepEqual(await store.getVerifiedPdf(record.sha256), pdf);
    assert.deepEqual(await readFile(path.join(root, record.storageKey)), pdf);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
