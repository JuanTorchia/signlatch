import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  digestToolArguments,
  type ImmutableArtifactStore,
  type PdfToolCaller,
  type PreparedPdf,
  type ProvenanceEntry,
  type ToolCall,
  validateDocumentPrompt,
} from "@/core/pdf/preparation";

export async function prepareTextPdf(
  prompt: string,
  caller: PdfToolCaller,
  artifacts: ImmutableArtifactStore,
): Promise<PreparedPdf> {
  const documentText = validateDocumentPrompt(prompt);
  const workspace = await mkdtemp(path.join(os.tmpdir(), "signlatch-foxit-"));
  const outputPath = path.join(workspace, "prepared.pdf");
  const provenance: ProvenanceEntry[] = [];

  const invoke = async (call: ToolCall, safeArguments: Record<string, unknown>) => {
    const result = await caller.call(call);
    provenance.push({
      sequence: provenance.length + 1,
      tool: call.name,
      argumentsDigest: digestToolArguments(safeArguments),
      inputDocumentId:
        typeof call.arguments.documentId === "string" ? call.arguments.documentId : undefined,
      outputDocumentId: result.resultDocumentId || result.documentId,
      taskId: result.taskId,
    });
    return result;
  };

  try {
    const upload = await invoke(
    {
      name: "upload_document",
      arguments: {
        fileContent: Buffer.from(documentText, "utf8").toString("base64"),
        fileName: "signlatch-request.txt",
      },
    },
    { contentSha256: digestToolArguments({ documentText }), fileName: "signlatch-request.txt" },
  );
    if (!upload.documentId) throw new Error("Foxit upload did not return documentId");

    const converted = await invoke(
      { name: "pdf_from_text", arguments: { documentId: upload.documentId } },
      { documentId: upload.documentId },
    );
    if (!converted.resultDocumentId) {
      throw new Error("Foxit conversion did not return resultDocumentId");
    }

    await invoke(
      {
        name: "download_document",
        arguments: { documentId: converted.resultDocumentId, outputPath },
      },
      { documentId: converted.resultDocumentId, outputPath: "<ephemeral>/prepared.pdf" },
    );

    const pdfBytes = await readFile(outputPath);
    const artifact = await artifacts.putPdf(pdfBytes);
    return { artifact, provenance };
  } finally {
    await caller.close?.();
    await rm(workspace, { recursive: true, force: true });
  }
}
