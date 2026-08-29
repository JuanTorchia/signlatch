"use client";

import { useEffect, useRef, useState } from "react";

const mutations = [
  { key: "recipient", label: "Change recipient email", before: "alex@example.invalid", after: "finance@example.invalid", field: "recipient.email" },
  { key: "artifact", label: "Replace document version", before: "Supplier Agreement · approved PDF", after: "Supplier Agreement · revised PDF", field: "document.sha256" },
  { key: "field", label: "Move signature field", before: "Signature · page 1, lower right", after: "Signature · page 2, upper left", field: "signatureField.position" },
  { key: "finding", label: "Add policy warning", before: "No blocking policy warning", after: "Missing supplier tax form", field: "policy.findings" },
  { key: "intent", label: "Change payment terms", before: "Payment terms · Net 30", after: "Payment terms · Net 7", field: "agreement.intent" },
] as const;
type MutationKey = (typeof mutations)[number]["key"];
type Status = "review" | "approved" | "invalidated";

const stateCopy = {
  review: { label: "Review required", detail: "No approval is recorded." },
  approved: { label: "Simulated approval", detail: "Recorded in this browser only." },
  invalidated: { label: "Approval invalidated", detail: "A fresh review is required." },
} as const;

export function FixtureApprovalDemo() {
  const [status, setStatus] = useState<Status>("review");
  const [category, setCategory] = useState<MutationKey | "">("");
  const [reviewed, setReviewed] = useState(false);
  const mutationRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const selectedMutation = mutations.find((item) => item.key === category);
  const message = status === "approved"
    ? "Fixture approval recorded locally. No provider action was unlocked or sent."
    : status === "invalidated"
      ? `Approval invalidated because ${selectedMutation?.label.toLowerCase()}. Restoring the old value still requires a fresh approval.`
      : "Exact fixture is ready for human review.";

  useEffect(() => {
    if (status === "approved") mutationRef.current?.focus();
    if (status === "invalidated") resetRef.current?.focus();
  }, [status]);

  function reset() {
    setCategory("");
    setStatus("review");
    setReviewed(false);
    requestAnimationFrame(() => confirmationRef.current?.focus());
  }

  return (
    <section className="demo shell" aria-labelledby="fixture-approval-title">
      <p className="eyebrow">Fixture-demonstrated · zero SignLatch/provider effects</p>
      <h2 id="fixture-approval-title">Try the exact approval latch</h2>
      <p className="demo-intro">Review the exact fixture, record a simulated approval, then challenge it with any material mutation. The provider boundary remains locked throughout.</p>
      <div className="fixture-state" data-state={status} aria-label="Fixture ceremony state">
        <div><span className="label">Application state</span><strong>{stateCopy[status].label}</strong><small>{stateCopy[status].detail}</small></div>
        <div><span className="label">Provider state</span><strong>Locked</strong><small>Zero SignLatch/provider effects</small></div>
      </div>
      <p className="fixture-message" role="status" aria-live="polite" aria-atomic="true">{message}</p>
      <div className="review-diff" data-state={status} aria-label="Exact mutation evidence">
        <div className="diff-heading"><span>{status === "invalidated" ? "Exact business change" : "Bound snapshot"}</span><code>{status === "invalidated" ? selectedMutation?.field : "approval-v2 / exact fixture"}</code></div>
        {status === "invalidated" ? <>
          <p><del>{selectedMutation?.before}</del></p>
          <p><ins>{selectedMutation?.after}</ins></p>
        </> : <p className="diff-placeholder">{status === "approved" ? "The exact snapshot is approved. Choose one material mutation to challenge it." : "Review and approve the exact snapshot before introducing a mutation."}</p>}
        <div className="diff-result"><strong>{status === "invalidated" ? "APPROVAL INVALIDATED" : status === "approved" ? "APPROVAL ACTIVE" : "AWAITING APPROVAL"}</strong><span>Provider: LOCKED</span></div>
      </div>
      <fieldset className="mutation-matrix">
        <legend>Challenge the approval with a real-world change</legend>
        <p>Start with the recipient change, or open any other material-change case. Every case must invalidate approval.</p>
        <div className="mutation-buttons">
        {mutations.map((item, index) => (
          <button data-mutation={item.key} ref={index === 0 ? mutationRef : undefined} className={`button button-secondary ${index === 0 ? "mutation-primary" : ""}`} type="button" key={item.key} disabled={status !== "approved"} onClick={() => { setCategory(item.key); setStatus("invalidated"); setReviewed(false); }}>
            {item.label}
          </button>
        ))}
        </div>
      </fieldset>
      <label className="review-confirmation">
        <input ref={confirmationRef} type="checkbox" checked={reviewed} disabled={status !== "review"} onChange={(event) => setReviewed(event.target.checked)} />{" "}
        I reviewed the exact fixture snapshot.
      </label>
      <div className="fixture-actions">
        <button className="button button-primary" type="button" disabled={status !== "review" || !reviewed} onClick={() => setStatus("approved")}>Record simulated approval</button>
        {status !== "review" ? <button ref={resetRef} className="button button-secondary" type="button" onClick={reset}>Start a fresh fixture review</button> : null}
      </div>
      <p className="fixture-boundary"><strong>Fixture boundary:</strong> no SignLatch provider-effect request, signing action, or credit use can originate here. Hosting infrastructure may emit operational telemetry.</p>
    </section>
  );
}
