import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type PdfParserResult = {
  valid: boolean;
  encrypted: boolean;
  pages: number;
  outputBytes: number;
  reason?: string;
};

export type PdfParserRunner = (bytes: Uint8Array) => Promise<PdfParserResult>;

export class PdfValidationError extends Error {
  constructor(message: string, readonly quarantine = true) {
    super(message);
    this.name = "PdfValidationError";
  }
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 256 * 1024;

export class SandboxedPdfValidator {
  constructor(private readonly runParser: PdfParserRunner) {}

  async validate(bytes: Uint8Array): Promise<PdfParserResult> {
    if (bytes.byteLength < 16 || bytes.byteLength > MAX_PDF_BYTES) {
      throw new PdfValidationError(`PDF size must be between 16 and ${MAX_PDF_BYTES} bytes`);
    }
    const content = Buffer.from(bytes).toString("latin1");
    if (!content.startsWith("%PDF-1.")) throw new PdfValidationError("Unsupported PDF header");
    if (!/%%EOF\s*$/.test(content)) throw new PdfValidationError("PDF has trailing content or is truncated");

    const result = await this.runParser(bytes);
    if (result.outputBytes > MAX_OUTPUT_BYTES) throw new PdfValidationError("PDF parser output limit exceeded");
    if (!result.valid) throw new PdfValidationError(`PDF structure rejected: ${result.reason ?? "invalid"}`);
    if (result.encrypted) throw new PdfValidationError("Encrypted PDFs are not reviewable");
    if (!Number.isSafeInteger(result.pages) || result.pages < 1) throw new PdfValidationError("PDF has no valid pages");
    return result;
  }
}

export function createQpdfRunner(command = "/usr/bin/qpdf"): PdfParserRunner {
  return async (bytes) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "signlatch-qpdf-"));
    const pdfPath = path.join(directory, "input.pdf");
    try {
      await writeFile(pdfPath, bytes, { mode: 0o600 });
      return await runQpdf(command, pdfPath);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };
}

function runQpdf(command: string, pdfPath: string): Promise<PdfParserResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["--check", "--show-npages", pdfPath], {
      cwd: path.dirname(pdfPath),
      env: { ...process.env, PATH: "/usr/bin:/bin" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end();
    let output = Buffer.alloc(0);
    const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
    const collect = (chunk: Buffer) => {
      output = Buffer.concat([output, chunk]);
      if (output.byteLength > MAX_OUTPUT_BYTES) child.kill("SIGKILL");
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      const text = output.toString("utf8");
      const pageMatch = text.match(/(?:^|\n)(\d+)(?:\n|$)/);
      resolve({
        valid: code === 0,
        encrypted: qpdfReportsEncryption(text),
        pages: pageMatch ? Number(pageMatch[1]) : 0,
        outputBytes: output.byteLength,
        reason: code === 0 ? undefined : "qpdf check failed",
      });
    });
  });
}

export function qpdfReportsEncryption(output: string): boolean {
  return /(?:^|\n)File is encrypted(?:\n|$)/i.test(output);
}
