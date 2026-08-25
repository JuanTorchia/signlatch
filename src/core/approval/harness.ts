import {
  approvalDigest,
  documentDigest,
  isApprovalFresh,
  type ApprovalEnvelopeV1,
} from "./envelope";

type ApprovalRecord = {
  digest: string;
  consumed: boolean;
};

export class ApprovalHarness {
  private readonly approvals = new Map<string, ApprovalRecord>();

  approve(envelope: ApprovalEnvelopeV1): string {
    const digest = approvalDigest(envelope);
    this.approvals.set(envelope.approvalId, { digest, consumed: false });
    return digest;
  }

  dispatch(envelope: ApprovalEnvelopeV1, documentBytes: Uint8Array, now: Date): string {
    const record = this.approvals.get(envelope.approvalId);
    if (!record) throw new Error("Approval does not exist");
    if (record.consumed) throw new Error("Approval has already been consumed");
    if (!isApprovalFresh(envelope, now)) throw new Error("Approval has expired");
    if (documentDigest(documentBytes) !== envelope.documentSha256) {
      throw new Error("Document bytes do not match the approved artifact");
    }
    if (approvalDigest(envelope) !== record.digest) {
      throw new Error("Approval envelope changed after human approval");
    }

    record.consumed = true;
    return `signlatch:${envelope.approvalId}`;
  }
}
