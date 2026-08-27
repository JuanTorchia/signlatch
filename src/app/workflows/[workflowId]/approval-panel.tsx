"use client";

import { useState } from "react";

export function ApprovalPanel(props: { workflowId: string; reviewVersion: number; reviewDigest: string; csrf: string; canApprove: boolean; state: string; materialDiff: unknown[]; approvalIsFresh: boolean; approvalExpiresAt: string | null }) {
  const [state, setState] = useState(props.state);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState(props.approvalIsFresh ? "Approval recorded. No email has been sent." : "Review the PDF and recipient before confirming.");
  async function approve() {
    setState("confirming");
    const response = await fetch(`/api/workflows/${props.workflowId}/approve`, { method: "POST", headers: { "content-type": "application/json", "x-signlatch-csrf": props.csrf }, body: JSON.stringify({ reviewVersion: props.reviewVersion, reviewDigest: props.reviewDigest }) });
    const body = await response.json() as { error?: string };
    setState(response.ok ? "approved" : "invalidated");
    setMessage(response.ok ? "Exact approval recorded. Any material mutation will invalidate it." : body.error ?? "Approval was denied.");
  }
  const canReview = props.canApprove && (state === "review" || (state === "approved" && !props.approvalIsFresh));
  const canSubmit = canReview && confirmed;
  return <section aria-labelledby="approval-title" className="action-card approval-ceremony">
    <div className="action-number" aria-hidden="true">2</div>
    <div className="action-content"><p className="step-label">Human decision</p><h2 id="approval-title">Approve this exact version</h2>
    <p role="status" aria-live="polite" className="action-status">{message}</p>
    {props.materialDiff.length > 0 && <details open><summary>Material changes require reapproval</summary><pre>{JSON.stringify(props.materialDiff, null, 2)}</pre></details>}
    {props.approvalIsFresh ? <p className="success-note">✓ Approved until {props.approvalExpiresAt ? new Date(props.approvalExpiresAt).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" }) : "the recorded expiry"}.</p> : <>
      <label className="approval-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!canReview} /> <span>I checked the PDF, recipient and signature field shown above.</span></label>
      <button className="button button-primary" type="button" onClick={approve} disabled={!canSubmit}>Approve this version</button>
    </>}
    {!props.canApprove ? <p className="muted-copy">Your account does not have approval permission.</p> : null}
    </div>
  </section>;
}
