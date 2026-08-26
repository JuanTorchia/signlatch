import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ArtifactRecord,
  ImmutableArtifactStore,
  ProvenanceManifest,
} from "@/core/pdf/preparation";
import { sha256 } from "@/core/pdf/preparation";
import { ArtifactIntegrityError, ArtifactNotFoundError } from "./artifact-errors";
import { createQpdfRunner, SandboxedPdfValidator } from "./pdf-validator";

export function artifactRootFromEnv(): string {
  const configured=process.env.SIGNLATCH_ARTIFACT_ROOT?.trim();
  if(configured){if(!path.isAbsolute(configured))throw new Error("SIGNLATCH_ARTIFACT_ROOT must be absolute");return configured;}
  if(process.env.NODE_ENV==="production")throw new Error("SIGNLATCH_ARTIFACT_ROOT is required in production");
  return path.join(process.cwd(),".data","artifacts");
}

export class FilesystemArtifactStore implements ImmutableArtifactStore {
  constructor(
    private readonly root: string,
    private readonly validator = new SandboxedPdfValidator(createQpdfRunner()),
  ) {}

  async putPdf(bytes: Uint8Array): Promise<ArtifactRecord> {
    validateReviewablePdf(bytes);
    await this.validator.validate(bytes);

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

  async getVerifiedPdf(digest: string): Promise<Buffer> {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new ArtifactNotFoundError();
    const storageKey = path.join("sha256", digest.slice(0, 2), `${digest}.pdf`);
    const absolutePath = path.join(this.root, storageKey);
    let bytes: Buffer;
    try {
      bytes = await readFile(absolutePath);
    } catch {
      throw new ArtifactNotFoundError();
    }
    if (sha256(bytes) !== digest) {
      const quarantine = path.join(this.root, "quarantine", `${digest}-${Date.now()}.pdf`);
      await mkdir(path.dirname(quarantine), { recursive: true });
      await rename(absolutePath, quarantine).catch(() => undefined);
      throw new ArtifactIntegrityError();
    }
    await this.validator.validate(bytes);
    return bytes;
  }

  async putManifest(manifest: ProvenanceManifest): Promise<string> {
    const storageKey = path.join("manifests", `${manifest.manifestSha256}.json`);
    const absolutePath = path.join(this.root, storageKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    const bytes = Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8");
    try {
      await writeFile(absolutePath, bytes, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      const existing = await readFile(absolutePath);
      if (!existing.equals(bytes)) throw new Error("Immutable provenance collision");
    }
    return storageKey;
  }
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const FORBIDDEN_PDF_FEATURES = [
  "/JavaScript",
  "/OpenAction",
  "/EmbeddedFile",
  "/Launch",
  "/RichMedia",
  "/XFA",
];

export function validateReviewablePdf(bytes: Uint8Array): void {
  if (bytes.length < 16 || bytes.length > MAX_PDF_BYTES) {
    throw new Error(`PDF size must be between 16 and ${MAX_PDF_BYTES} bytes`);
  }
  const content = Buffer.from(bytes).toString("latin1");
  if (!content.startsWith("%PDF-1.")) throw new Error("Foxit output is not a supported PDF");
  if (!/%%EOF\s*$/.test(content)) throw new Error("PDF is truncated or has trailing content");
  if (!/startxref\s+\d+\s+%%EOF\s*$/.test(content)) {
    throw new Error("PDF has no valid final cross-reference marker");
  }
  for (const feature of FORBIDDEN_PDF_FEATURES) {
    if (content.includes(feature)) throw new Error(`PDF contains forbidden feature: ${feature}`);
  }
}
