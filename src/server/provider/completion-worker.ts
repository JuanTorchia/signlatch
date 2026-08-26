import type { Sql } from "postgres";
import type { ArtifactRecord, ImmutableArtifactStore } from "@/core/pdf/preparation";

export interface ExecutedDocumentClient {
  downloadExecutedDocument(envelopeId: string): Promise<Uint8Array>;
}

export class CompletionWorker {
  constructor(
    private readonly sql: Sql,
    private readonly client: ExecutedDocumentClient,
    private readonly artifacts: ImmutableArtifactStore,
  ) {}

  async complete(envelopeId: string): Promise<ArtifactRecord> {
    const existing = await this.sql<Array<{
      artifact_sha256: string;
      actual_size: number | string;
      storage_key: string;
    }>>`
      select artifact_sha256, actual_size, storage_key
      from executed_documents where provider_envelope_id = ${envelopeId}
    `;
    if (existing[0]) {
      return {
        id: `sha256:${existing[0].artifact_sha256}`,
        sha256: existing[0].artifact_sha256,
        size: Number(existing[0].actual_size),
        mediaType: "application/pdf",
        storageKey: existing[0].storage_key,
      };
    }

    const rows = await this.sql<Array<{ dispatch_id: string; lifecycle_state: string }>>`
      select dispatch_id, lifecycle_state from esign_dispatches
      where provider_envelope_id = ${envelopeId}
    `;
    const dispatch = rows[0];
    if (!dispatch || dispatch.lifecycle_state !== "completed") {
      throw new Error("Envelope is not verified complete");
    }
    const bytes = await this.client.downloadExecutedDocument(envelopeId);
    const artifact = await this.artifacts.putPdf(bytes);
    await this.sql`
      insert into executed_documents (
        dispatch_id, artifact_sha256, actual_size, storage_key, provider_envelope_id
      ) values (
        ${dispatch.dispatch_id}, ${artifact.sha256}, ${artifact.size},
        ${artifact.storageKey}, ${envelopeId}
      ) on conflict(dispatch_id) do nothing
    `;
    return artifact;
  }
}
