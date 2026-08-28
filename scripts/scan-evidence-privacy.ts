import { readFile } from "node:fs/promises";
import path from "node:path";

import { privacyFindings } from "../src/core/evidence/manifest";
import { listJsonEvidence } from "./verify-evidence";

async function main() {
  const root = path.join(process.cwd(), "evidence");
  const findings = [];
  const names = await listJsonEvidence(root);
  for (const name of names) {
    const hits = privacyFindings(await readFile(path.join(root, name), "utf8"));
    if (hits.length) findings.push({ path: `evidence/${name.split(path.sep).join("/")}`, hits });
  }
  if (findings.length) {
    console.error(JSON.stringify(findings));
    process.exitCode = 1;
  } else console.log(JSON.stringify({ files: names.length, findings: 0 }));
}

void main();
