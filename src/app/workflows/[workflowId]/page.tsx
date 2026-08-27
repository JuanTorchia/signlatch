import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { createCsrfToken, parseSession } from "@/server/auth/session";
import { can } from "@/server/auth/authorize";
import { database } from "@/server/database";
import { ReviewStore } from "@/server/workflow/review-store";
import { ApprovalPanel } from "./approval-panel";
import { DispatchPanel } from "./dispatch-panel";
import { Timeline, type TimelineEvent } from "./timeline";
import { TimelineStore } from "@/server/provider/timeline-store";

export default async function WorkflowReviewPage({ params }: PageProps<"/workflows/[workflowId]">) {
  const { workflowId } = await params;
  const token = (await cookies()).get("signlatch_session")?.value;
  const secret = process.env.AUTH_SESSION_SECRET;
  const session = token && secret ? parseSession(token, secret) : null;
  if (!session) notFound();
  const review = await new ReviewStore(database()).getReview(workflowId, session.tenantId);
  if (!review) notFound();
  const timeline = await new TimelineStore(database()).get(workflowId, session.tenantId).catch(() => []);
  const snapshot = review.snapshot_payload as {
    artifactSha256: string;
    recipients: Array<{ id: string; email: string; order: number }>;
    fields: Array<{ id: string; recipientId: string; page: number }>;
    findings: Array<{ ruleId: string; severity: string; message: string }>;
    provenanceSha256: string;
    intent: {
      buyer: { name: string };
      supplier: { name: string };
      paymentTerms: string;
      liabilityCap: string;
      governingLaw?: string;
    };
  };
  const approvalExpiresAt = review.approval_expires_at ? new Date(String(review.approval_expires_at)) : null;
  const approvalIsFresh = String(review.state) === "approved" && review.approval_is_fresh === true;
  const dispatchEnabled = process.env.SIGNLATCH_ESIGN_ENQUEUE_ENABLED === "true";
  return (
    <main className="shell workflow-review">
      <header className="review-header">
        <div><p className="eyebrow">Private signing workspace</p><h1>Review supplier agreement</h1></div>
        <span className={`status ${approvalIsFresh ? "status-approved" : "status-blocked"}`}>
          {approvalIsFresh ? "Approved, not sent" : "Not ready to send"}
        </span>
      </header>
      <section className="delivery-banner" aria-labelledby="review-status">
        <div className="delivery-icon" aria-hidden="true">✉</div>
        <div>
          <h2 id="review-status">No email has been sent</h2>
          <p>Approval only locks this exact PDF and recipient. Sending through Foxit is a separate, currently disabled action.</p>
        </div>
      </section>
      <ol className="progress-steps" aria-label="Signing progress">
        <li data-complete="true"><span>1</span><div><strong>PDF prepared</strong><small>Foxit generated and verified the document.</small></div></li>
        <li data-complete={approvalIsFresh}><span>2</span><div><strong>{approvalIsFresh ? "Approval recorded" : "Approval required"}</strong><small>{approvalIsFresh && approvalExpiresAt ? `Valid until ${approvalExpiresAt.toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })}.` : "Review and approve the exact snapshot."}</small></div></li>
        <li data-complete="false"><span>3</span><div><strong>Email not sent</strong><small>Foxit dispatch remains disabled.</small></div></li>
      </ol>
      <div className="review-columns">
        <section className="review-card document-card" aria-labelledby="artifact-title">
          <div className="card-heading"><div><p className="step-label">Document</p><h2 id="artifact-title">Exact PDF</h2></div><a className="button button-secondary" href={`/api/artifacts/${snapshot.artifactSha256}`} target="_blank" rel="noreferrer">Open PDF</a></div>
          <iframe title="Prepared supplier agreement" src={`/api/artifacts/${snapshot.artifactSha256}`} />
          <details><summary>Technical fingerprint</summary><code>{snapshot.artifactSha256}</code></details>
        </section>
        <aside className="review-sidebar">
          <section className="review-card" aria-labelledby="agreement-title">
            <p className="step-label">Agreement</p><h2 id="agreement-title">What you are approving</h2>
            <dl className="review-facts">
              <div><dt>Buyer</dt><dd>{snapshot.intent.buyer.name}</dd></div>
              <div><dt>Supplier</dt><dd>{snapshot.intent.supplier.name}</dd></div>
              <div><dt>Payment</dt><dd>{snapshot.intent.paymentTerms}</dd></div>
              <div><dt>Liability cap</dt><dd>{snapshot.intent.liabilityCap}</dd></div>
              <div><dt>Governing law</dt><dd>{snapshot.intent.governingLaw ?? "Not specified"}</dd></div>
            </dl>
          </section>
          <section className="review-card" aria-labelledby="recipient-title">
            <p className="step-label">Recipient</p><h2 id="recipient-title">Who would receive it</h2>
            {snapshot.recipients.map((recipient) => <p className="recipient-email" key={recipient.id}>{recipient.email}</p>)}
            <p className="muted-copy">One signature field on page {snapshot.fields[0]?.page ?? 1}. Nothing has been emailed.</p>
          </section>
          <section className="review-card compact-card" aria-labelledby="finding-title">
            <p className="step-label">Checks</p><h2 id="finding-title">Policy result</h2>
            {snapshot.findings.map((finding) => <p className="finding" key={finding.ruleId}><strong>{finding.severity}</strong> {finding.message}</p>)}
            <details><summary>Foxit provenance</summary><code>{snapshot.provenanceSha256}</code></details>
          </section>
        </aside>
      </div>
      <ApprovalPanel workflowId={workflowId} reviewVersion={Number(review.version)} reviewDigest={String(review.snapshot_digest)}
        csrf={createCsrfToken(token!, secret!)} canApprove={can(session.roles, "approve")} state={String(review.state)}
        materialDiff={(review.material_diff as unknown[]) ?? []} approvalIsFresh={approvalIsFresh} approvalExpiresAt={approvalExpiresAt?.toISOString() ?? null} />
      <DispatchPanel workflowId={workflowId} csrf={createCsrfToken(token!, secret!)} canDispatch={can(session.roles, "dispatch")} workflowState={String(review.state)} dispatchEnabled={dispatchEnabled} approvalIsFresh={approvalIsFresh} />
      <Timeline events={timeline as unknown as TimelineEvent[]} />
    </main>
  );
}
