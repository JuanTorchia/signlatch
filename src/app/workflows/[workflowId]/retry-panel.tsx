"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryPanel(props: { workflowId: string; csrf: string; canRetry: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("The failed attempt remains immutable. A retry creates a new review and requires a fresh approval.");
  const [busy, setBusy] = useState(false);
  async function retry() {
    setBusy(true);
    const response = await fetch(`/api/workflows/${props.workflowId}/retry`, {
      method: "POST",
      headers: { "x-signlatch-csrf": props.csrf },
    });
    const body = await response.json() as { workflowId?: string; error?: string };
    if (response.ok && body.workflowId) router.push(`/workflows/${body.workflowId}`);
    else {
      setMessage(body.error ?? "A fresh attempt could not be created.");
      setBusy(false);
    }
  }
  return <section className="action-card" aria-labelledby="retry-title">
    <div className="action-number" aria-hidden="true">↻</div>
    <div className="action-content">
      <p className="step-label">Safe recovery</p><h2 id="retry-title">Start a fresh attempt</h2>
      <p className="action-status" role="status" aria-live="polite">{message}</p>
      <button className="button button-secondary" type="button" onClick={retry} disabled={!props.canRetry || busy}>
        {busy ? "Creating fresh review…" : "Create fresh review"}
      </button>
    </div>
  </section>;
}
