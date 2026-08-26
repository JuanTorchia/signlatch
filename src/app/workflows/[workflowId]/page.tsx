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
  };
  return (
    <main className="shell workflow-review">
      <header className="section-heading">
        <div><p className="eyebrow">Exact human review</p><h1>Supplier agreement checkpoint</h1></div>
        <span className="status status-blocked">Signing latched</span>
      </header>
      <section aria-labelledby="review-status">
        <h2 id="review-status">Review status</h2>
        <p>No signing request has been sent. Approval is a separate future ceremony.</p>
        <p><strong>Snapshot digest:</strong> <code>{String(review.snapshot_digest)}</code></p>
        <p>This digest identifies every value shown below. Any material change creates a new snapshot.</p>
      </section>
      <section aria-labelledby="artifact-title">
        <h2 id="artifact-title">Exact document</h2>
        <iframe title="Prepared supplier agreement" src={`/api/artifacts/${snapshot.artifactSha256}`} />
        <p><strong>Artifact SHA-256:</strong> <code>{snapshot.artifactSha256}</code></p>
      </section>
      <section aria-labelledby="recipient-title">
        <h2 id="recipient-title">Recipients and fields</h2>
        <ul>{snapshot.recipients.map((recipient) => <li key={recipient.id}>{recipient.order}. {recipient.email}</li>)}</ul>
        <ul>{snapshot.fields.map((field) => <li key={field.id}>{field.id}: page {field.page}, assigned to {field.recipientId}</li>)}</ul>
      </section>
      <section aria-labelledby="finding-title">
        <h2 id="finding-title">Policy findings</h2>
        <ul>{snapshot.findings.map((finding) => <li key={finding.ruleId}><strong>{finding.severity}</strong>: {finding.message}</li>)}</ul>
      </section>
      <section aria-labelledby="provenance-title">
        <h2 id="provenance-title">Foxit provenance</h2>
        <p><code>{snapshot.provenanceSha256}</code></p>
      </section>
      <ApprovalPanel workflowId={workflowId} reviewVersion={Number(review.version)} reviewDigest={String(review.snapshot_digest)}
        csrf={createCsrfToken(token!, secret!)} canApprove={can(session.roles, "approve")} state={String(review.state)}
        materialDiff={(review.material_diff as unknown[]) ?? []} />
      <DispatchPanel workflowId={workflowId} csrf={createCsrfToken(token!, secret!)} canDispatch={can(session.roles, "dispatch")} workflowState={String(review.state)} />
      <Timeline events={timeline as unknown as TimelineEvent[]} />
    </main>
  );
}
