import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ArtifactRecord, ImmutableArtifactStore } from "@/core/pdf/preparation";
import { sha256 } from "@/core/pdf/preparation";

export class FilesystemArtifactStore implements ImmutableArtifactStore {
  constructor(private readonly root: string) {}

  async putPdf(bytes: Uint8Array): Promise<ArtifactRecord> {
    if (bytes.length < 5 || Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
      throw new Error("Foxit output is not a PDF");
    }

    const digest = sha256(bytes);
    const storageKey = path.join("sha256", digest.slice(0, 2), `${digest}.pdf`);
    const absolutePath = path.join(this.root, storageKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });

    try {
      await writeFile(absolutePath, bytes, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      const existing = await readFile(absolutePath);
      if (sha256(existing) !== digest) throw new Error("Immutable artifact collision");
    }

    return {
      id: `sha256:${digest}`,
      sha256: digest,
      size: bytes.length,
      mediaType: "application/pdf",
      storageKey,
    };
  }
}
