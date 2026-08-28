import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { createEvidenceManifest, evidenceDigest } from "../src/core/evidence/manifest";

export async function listJsonEvidence(root: string, relative = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(entries.map(async (entry) => {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) return listJsonEvidence(root, next);
    return entry.isFile() && entry.name.endsWith(".json") && entry.name !== "MANIFEST.json" ? [next] : [];
  }));
  return files.flat().sort();
}

async function main() {
  const root = path.join(process.cwd(), "evidence");
  const entries = [];
  for (const name of await listJsonEvidence(root)) {
    const bytes = await readFile(path.join(root, name));
    const data = JSON.parse(bytes.toString()) as Record<string, unknown>;
    entries.push({
      path: `evidence/${name.split(path.sep).join("/")}`,
      sha256: evidenceDigest(bytes),
      capturedAt: String(data.capturedAt ?? data.generatedAt ?? data.recordedAt),
      claim: String(data.claim ?? "sanitized evidence"),
      status: (data.status ?? data.claimStatus ?? "fixture-demonstrated") as "fixture-demonstrated",
    });
  }
  process.stdout.write(`${JSON.stringify(createEvidenceManifest(entries, new Date().toISOString()), null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) void main();
