import type { Sql } from "postgres";
import type { ArtifactRecord, ImmutableArtifactStore } from "@/core/pdf/preparation";

export interface ExecutedDocumentClient {
  downloadExecutedDocument(envelopeId: string): Promise<Uint8Array>;
}

export interface CompletionArtifactStore extends ImmutableArtifactStore {
  getVerifiedPdf(digest: string): Promise<Uint8Array>;
}

export class CompletionWorker {
  constructor(
    private readonly sql: Sql,
    private readonly client: ExecutedDocumentClient,
    private readonly artifacts: CompletionArtifactStore,
  ) {}

  async complete(envelopeId: string): Promise<ArtifactRecord> {
    const current = await this.findExisting(envelopeId);
    let candidate: ArtifactRecord | undefined;
    if (!current) {
      const bytes = await this.client.downloadExecutedDocument(envelopeId);
      candidate = await this.artifacts.putPdf(bytes);
    }
    const canonical = await this.sql.begin(async (tx) => {
      const rows = await tx<Array<{ dispatch_id: string; lifecycle_state: string }>>`
        select dispatch_id, lifecycle_state from esign_dispatches
        where provider_envelope_id = ${envelopeId}
        for update
      `;
      const dispatch = rows[0];
      if (!dispatch || dispatch.lifecycle_state !== "executed") {
        throw new Error("Envelope is not verified complete");
      }
      const existing = await tx<Array<StoredArtifact>>`
        select artifact_sha256, actual_size, storage_key
        from executed_documents where dispatch_id = ${dispatch.dispatch_id}
      `;
      if (existing[0]) return artifactRecord(existing[0]);
      if (!candidate) throw new Error("Executed document candidate is missing");
      await tx`
        insert into executed_documents (
          dispatch_id, artifact_sha256, actual_size, storage_key, provider_envelope_id
        ) values (
          ${dispatch.dispatch_id}, ${candidate.sha256}, ${candidate.size},
          ${candidate.storageKey}, ${envelopeId}
        )
      `;
      return candidate;
    });

    const verified = await this.artifacts.getVerifiedPdf(canonical.sha256);
    if (verified.length !== canonical.size) throw new Error("Executed document size changed");
    const updated = await this.sql.begin(async (tx) => {
      const rows = await tx<Array<{ workflow_id: string; lifecycle_state: string }>>`
        select workflow_id, lifecycle_state from esign_dispatches
        where provider_envelope_id = ${envelopeId}
        for update
      `;
      const dispatch = rows[0];
      if (!dispatch || dispatch.lifecycle_state !== "executed") return 0;
      const stored = await tx<Array<StoredArtifact>>`
        select artifact_sha256, actual_size, storage_key from executed_documents
        where provider_envelope_id = ${envelopeId}
      `;
      if (!stored[0]
        || stored[0].artifact_sha256 !== canonical.sha256
        || Number(stored[0].actual_size) !== canonical.size
        || stored[0].storage_key !== canonical.storageKey) return 0;
      const result = await tx`
        update agreement_workflows set state = 'completed', updated_at = now()
        where workflow_id = ${dispatch.workflow_id} and state in ('sent', 'completed')
      `;
      return result.count;
    });
    if (updated !== 1) throw new Error("Workflow completion transition failed");
    return canonical;
  }

  private async findExisting(envelopeId: string): Promise<ArtifactRecord | undefined> {
    const rows = await this.sql<Array<StoredArtifact>>`
      select artifact_sha256, actual_size, storage_key
      from executed_documents where provider_envelope_id = ${envelopeId}
    `;
    return rows[0] ? artifactRecord(rows[0]) : undefined;
  }
}

type StoredArtifact = { artifact_sha256: string; actual_size: number | string; storage_key: string };

function artifactRecord(row: StoredArtifact): ArtifactRecord {
  return {
    id: `sha256:${row.artifact_sha256}`,
    sha256: row.artifact_sha256,
    size: Number(row.actual_size),
    mediaType: "application/pdf",
    storageKey: row.storage_key,
  };
}
