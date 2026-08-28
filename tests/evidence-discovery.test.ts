import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { listJsonEvidence } from "../scripts/verify-evidence";

test("discovers nested JSON evidence without treating a manifest as evidence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "signlatch-evidence-"));
  await mkdir(path.join(root, "m3", "browser"), { recursive: true });
  await Promise.all([
    writeFile(path.join(root, "root.json"), "{}"),
    writeFile(path.join(root, "m3", "proof.json"), "{}"),
    writeFile(path.join(root, "m3", "browser", "journey.json"), "{}"),
    writeFile(path.join(root, "m3", "MANIFEST.json"), "{}"),
    writeFile(path.join(root, "m3", "artifact.pdf"), "%PDF"),
  ]);
  assert.deepEqual(await listJsonEvidence(root), [
    path.join("m3", "browser", "journey.json"),
    path.join("m3", "proof.json"),
    "root.json",
  ]);
});
