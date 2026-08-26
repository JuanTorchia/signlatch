import {
  approvalDigest,
  documentDigest,
  isApprovalFresh,
  type ApprovalEnvelopeV1,
} from "./envelope";
import { assertExactApprovalFresh, exactApprovalDigest, type ExactApprovalV2 } from "./envelope-v2";
import type { ReviewSnapshot } from "../agreement/review";

type ApprovalRecord = {
  digest: string;
  consumed: boolean;
};

export class ApprovalHarness {
  private readonly approvals = new Map<string, ApprovalRecord>();
  private readonly exactApprovals = new Map<string, ApprovalRecord>();

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

  approveExact(approval: ExactApprovalV2, snapshot: ReviewSnapshot): string {
    if (approval.reviewVersion < 1 || approval.reviewDigest !== snapshot.digest) throw new Error("Review snapshot is stale");
    const digest = exactApprovalDigest(approval);
    this.exactApprovals.set(approval.nonce, { digest, consumed: false });
    return digest;
  }

  consumeExact(approval: ExactApprovalV2, snapshot: ReviewSnapshot, now: Date): string {
    const record = this.exactApprovals.get(approval.nonce);
    if (!record) throw new Error("Exact approval does not exist");
    if (record.consumed) throw new Error("Exact approval has already been consumed");
    assertExactApprovalFresh(approval, now);
    if (approval.reviewDigest !== snapshot.digest || exactApprovalDigest(approval) !== record.digest) {
      record.consumed = true;
      throw new Error("Exact review changed after human approval");
    }
    record.consumed = true;
    return `signlatch:v2:${record.digest}`;
  }
}
