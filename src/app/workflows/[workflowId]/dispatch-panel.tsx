"use client";
import { useState } from "react";

export function DispatchPanel(props: { workflowId: string; csrf: string; canDispatch: boolean; workflowState: string }) {
  const [status,setStatus]=useState(props.workflowState === "dispatching" ? "queued" : props.workflowState);
  async function enqueue(){setStatus("confirming"); const response=await fetch(`/api/workflows/${props.workflowId}/dispatch`,{method:"POST",headers:{"x-signlatch-csrf":props.csrf}}); const body=await response.json() as {error?:string}; setStatus(response.ok?"queued":`denied: ${body.error??"safe denial"}`);}
  return <section aria-labelledby="dispatch-title"><h2 id="dispatch-title">Controlled eSign dispatch</h2><p role="status" aria-live="polite">{status}</p><p>Dispatch is a separate dispatcher-only action. It rehashes the PDF and consumes the exact approval atomically.</p><button type="button" className="button button-primary" onClick={enqueue} disabled={!props.canDispatch||props.workflowState!=="approved"}>Queue one Foxit eSign envelope</button>{!props.canDispatch&&<p>Current role cannot dispatch.</p>}</section>;
}
