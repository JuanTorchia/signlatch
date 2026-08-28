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
    return this.sql.begin(async (tx) => {
      const rows = await tx<Array<{ dispatch_id: string; workflow_id: string; lifecycle_state: string }>>`
        select dispatch_id, workflow_id, lifecycle_state from esign_dispatches
        where provider_envelope_id = ${envelopeId}
        for update
      `;
      const dispatch = rows[0];
      if (!dispatch || dispatch.lifecycle_state !== "executed") {
        throw new Error("Envelope is not verified complete");
      }
      const existing = await tx<Array<{
        artifact_sha256: string;
        actual_size: number | string;
        storage_key: string;
      }>>`
        select artifact_sha256, actual_size, storage_key
        from executed_documents where dispatch_id = ${dispatch.dispatch_id}
      `;
      let artifact: ArtifactRecord;
      if (existing[0]) {
        artifact = {
          id: `sha256:${existing[0].artifact_sha256}`,
          sha256: existing[0].artifact_sha256,
          size: Number(existing[0].actual_size),
          mediaType: "application/pdf",
          storageKey: existing[0].storage_key,
        };
      } else {
        const bytes = await this.client.downloadExecutedDocument(envelopeId);
        artifact = await this.artifacts.putPdf(bytes);
        await tx`
          insert into executed_documents (
            dispatch_id, artifact_sha256, actual_size, storage_key, provider_envelope_id
          ) values (
            ${dispatch.dispatch_id}, ${artifact.sha256}, ${artifact.size},
            ${artifact.storageKey}, ${envelopeId}
          )
        `;
      }
      await tx`
        update agreement_workflows
        set state = 'completed', updated_at = now()
        where workflow_id = ${dispatch.workflow_id} and state in ('sent', 'completed')
      `;
      return artifact;
    });
  }
}
