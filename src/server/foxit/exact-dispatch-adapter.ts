import type { Sql } from "postgres";

import type { FilesystemArtifactStore } from "../artifacts/filesystem-store";
import type { ESignEnvelopeRequest, ESignResult, FoxitESignAdapter } from "./esign-adapter";
import type { ESignDispatchStore } from "../workflow/esign-dispatch-store";

type Lease = NonNullable<Awaited<ReturnType<ESignDispatchStore["leaseNext"]>>>;
type Snapshot = {
  intent: { signers: Array<{ id: string; name: string; email: string }> };
  recipients: Array<{ id: string; email: string; order: number }>;
  fields: Array<{ recipientId: string; page: number; rectangle: [number, number, number, number] }>;
};

export class ExactFoxitDispatchAdapter {
  constructor(
    private readonly sql: Sql,
    private readonly client: FoxitESignAdapter,
    private readonly artifacts: FilesystemArtifactStore,
  ) {}

  async send(lease: Lease): Promise<ESignResult> {
    let request: ESignEnvelopeRequest;
    try {
      const rows = await this.sql<Array<{ snapshot_payload: Snapshot }>>`
        select r.snapshot_payload from agreement_workflows w
        join review_snapshots r on r.workflow_id=w.workflow_id and r.version=w.active_review_version
        where w.workflow_id=${lease.workflow_id} and w.tenant_id=${lease.tenant_id}
      `;
      const snapshot = rows[0]?.snapshot_payload;
      if (!snapshot) return localDenial("review-not-found");
      const bytes = await this.artifacts.getVerifiedPdf(lease.document_sha256);
      const signerById = new Map(snapshot.intent.signers.map((signer) => [signer.id, signer]));
      const recipients = snapshot.recipients.map((recipient) => {
        const signer = signerById.get(recipient.id);
        if (!signer || signer.email !== recipient.email) throw new Error("recipient-mismatch");
        return { name: signer.name, email: recipient.email, order: recipient.order };
      });
      const fields = snapshot.fields.map((field) => {
        const recipient = snapshot.recipients.find((candidate) => candidate.id === field.recipientId);
        if (!recipient) throw new Error("field-recipient-missing");
        return { recipientEmail: recipient.email, page: field.page, x: field.rectangle[0], y: field.rectangle[1] };
      });
      request = {
        idempotencyKey: lease.idempotency_key,
        approvalDigest: lease.approval_digest,
        documentSha256: lease.document_sha256,
        documentBase64: Buffer.from(bytes).toString("base64"),
        recipients,
        fields,
        subject: "Supplier agreement for signature",
        message: "Please review and sign the approved supplier agreement.",
      };
    } catch (error) {
      const code = error instanceof Error && /^[a-z-]{1,64}$/.test(error.message) ? error.message : "preflight-failed";
      return localDenial(code);
    }
    return this.client.createEnvelope(request);
  }
}

function localDenial(code: string): ESignResult {
  return { status: "denied", errorCode: `local-${code}`, diagnostic: { phase: "local-validation", code } };
}
