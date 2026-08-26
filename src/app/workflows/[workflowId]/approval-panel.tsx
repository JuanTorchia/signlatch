"use client";

import { useState } from "react";

export function ApprovalPanel(props: { workflowId: string; reviewVersion: number; reviewDigest: string; csrf: string; canApprove: boolean; state: string; materialDiff: unknown[] }) {
  const [state, setState] = useState(props.state);
  const [message, setMessage] = useState(props.state === "approved" ? "This exact snapshot is approved." : "Review every bound value before confirming.");
  async function approve() {
    setState("confirming");
    const response = await fetch(`/api/workflows/${props.workflowId}/approve`, { method: "POST", headers: { "content-type": "application/json", "x-signlatch-csrf": props.csrf }, body: JSON.stringify({ reviewVersion: props.reviewVersion, reviewDigest: props.reviewDigest }) });
    const body = await response.json() as { error?: string };
    setState(response.ok ? "approved" : "invalidated");
    setMessage(response.ok ? "Exact approval recorded. Any material mutation will invalidate it." : body.error ?? "Approval was denied.");
  }
  return <section aria-labelledby="approval-title" className="approval-ceremony">
    <h2 id="approval-title">Human approval ceremony</h2>
    <p role="status" aria-live="polite"><strong>{state}</strong> — {message}</p>
    {props.materialDiff.length > 0 && <details open><summary>Material changes require reapproval</summary><pre>{JSON.stringify(props.materialDiff, null, 2)}</pre></details>}
    <label><input type="checkbox" required disabled={!props.canApprove || state !== "review"} /> I reviewed the exact document, recipients, fields, findings, intent, and provenance.</label>
    <button className="button button-primary" type="button" onClick={approve} disabled={!props.canApprove || state !== "review"}>Approve exact snapshot</button>
    {!props.canApprove && <p>Only a currently authorized approver can perform this action.</p>}
  </section>;
}
