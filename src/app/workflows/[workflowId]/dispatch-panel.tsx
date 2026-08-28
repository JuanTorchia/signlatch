"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DispatchPanel(props: { workflowId: string; csrf: string; canDispatch: boolean; workflowState: string; dispatchEnabled: boolean; approvalIsFresh: boolean }) {
  const router = useRouter();
  const [status,setStatus]=useState(props.workflowState);
  async function enqueue(){setStatus("confirming"); const response=await fetch(`/api/workflows/${props.workflowId}/dispatch`,{method:"POST",headers:{"x-signlatch-csrf":props.csrf}}); const body=await response.json() as {error?:string}; setStatus(response.ok?"dispatching":`denied: ${body.error??"safe denial"}`); if(response.ok)router.refresh();}
  const canSend = props.canDispatch && props.dispatchEnabled && props.workflowState === "approved" && props.approvalIsFresh;
  return <section aria-labelledby="dispatch-title" className="action-card dispatch-card">
    <div className="action-number" aria-hidden="true">3</div>
    <div className="action-content"><p className="step-label">Final action</p><h2 id="dispatch-title">Send for signature</h2>
      <p role="status" aria-live="polite" className="action-status">{dispatchMessage(status)}</p>
      <p className="muted-copy">This is the only step that emails the recipient and consumes an eSign operation.</p>
      <button type="button" className="button button-primary" onClick={enqueue} disabled={!canSend}>Send with Foxit eSign</button>
      {!props.dispatchEnabled ? <p className="gate-note">Sending is disabled in this environment. An operator must explicitly enable it.</p> : null}
      {!props.approvalIsFresh && props.workflowState === "approved" ? <p className="gate-note">A fresh approval is required before sending.</p> : null}
      {props.workflowState === "reconcile" ? <p className="gate-note">Do not resend. An operator must reconcile this attempt with Foxit first.</p> : null}
    </div>
  </section>;
}

function dispatchMessage(status: string): string {
  if (status === "queued" || status === "dispatching" || status === "confirming") return "One Foxit delivery attempt is in progress.";
  if (status === "sent") return "Foxit accepted the envelope. Check the recipient inbox and provider timeline.";
  if (status === "reconcile") return "Foxit delivery could not be confirmed. A duplicate-safe investigation is required.";
  if (status === "failed" || status.startsWith("denied:")) return "The envelope was not sent. Review the operator diagnosis before trying again.";
  return "No email has been sent.";
}
