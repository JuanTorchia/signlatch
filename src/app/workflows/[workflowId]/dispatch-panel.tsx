"use client";
import { useState } from "react";

export function DispatchPanel(props: { workflowId: string; csrf: string; canDispatch: boolean; workflowState: string; dispatchEnabled: boolean; approvalIsFresh: boolean }) {
  const [status,setStatus]=useState(props.workflowState === "dispatching" ? "queued" : props.workflowState);
  async function enqueue(){setStatus("confirming"); const response=await fetch(`/api/workflows/${props.workflowId}/dispatch`,{method:"POST",headers:{"x-signlatch-csrf":props.csrf}}); const body=await response.json() as {error?:string}; setStatus(response.ok?"queued":`denied: ${body.error??"safe denial"}`);}
  const canSend = props.canDispatch && props.dispatchEnabled && props.workflowState === "approved" && props.approvalIsFresh;
  return <section aria-labelledby="dispatch-title" className="action-card dispatch-card">
    <div className="action-number" aria-hidden="true">3</div>
    <div className="action-content"><p className="step-label">Final action</p><h2 id="dispatch-title">Send for signature</h2>
      <p role="status" aria-live="polite" className="action-status">{status === "queued" ? "Queued for Foxit delivery." : "No email has been sent."}</p>
      <p className="muted-copy">This is the only step that emails the recipient and consumes an eSign operation.</p>
      <button type="button" className="button button-primary" onClick={enqueue} disabled={!canSend}>Send with Foxit eSign</button>
      {!props.dispatchEnabled ? <p className="gate-note">Sending is disabled in this environment. An operator must explicitly enable it.</p> : null}
      {!props.approvalIsFresh ? <p className="gate-note">A fresh approval is required before sending.</p> : null}
    </div>
  </section>;
}
