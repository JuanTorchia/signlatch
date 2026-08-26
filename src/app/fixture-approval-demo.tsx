"use client";

import { useState } from "react";

const categories = ["artifact", "recipient", "field", "finding", "intent"] as const;
type Status = "review" | "approved" | "invalidated";

const stateCopy = {
  review: { label: "Review required", detail: "No approval is recorded." },
  approved: { label: "Simulated approval", detail: "Recorded in this browser only." },
  invalidated: { label: "Approval invalidated", detail: "A fresh review is required." },
} as const;

export function FixtureApprovalDemo() {
  const [status, setStatus] = useState<Status>("review");
  const [category, setCategory] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const message = status === "approved"
    ? "Fixture approval recorded locally. No provider action was unlocked or sent."
    : status === "invalidated"
      ? `Approval invalidated by ${category} mutation. Restoring values requires reapproval.`
      : "Exact fixture is ready for human review.";

  function reset() {
    setCategory("");
    setStatus("review");
    setReviewed(false);
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
      <fieldset className="mutation-matrix">
        <legend>Material mutation matrix</legend>
        <p>Each category must invalidate the current approval state.</p>
        <div className="mutation-buttons">
        {categories.map((item) => (
          <button className="button button-secondary" type="button" key={item} disabled={status !== "approved"} onClick={() => { setCategory(item); setStatus("invalidated"); setReviewed(false); }}>
            Mutate {item}
          </button>
        ))}
        </div>
      </fieldset>
      <label className="review-confirmation">
        <input type="checkbox" checked={reviewed} disabled={status !== "review"} onChange={(event) => setReviewed(event.target.checked)} />{" "}
        I reviewed the exact fixture snapshot.
      </label>
      <div className="fixture-actions">
        <button className="button button-primary" type="button" disabled={status !== "review" || !reviewed} onClick={() => setStatus("approved")}>Record simulated approval</button>
        {status !== "review" ? <button className="button button-secondary" type="button" onClick={reset}>Start a fresh fixture review</button> : null}
      </div>
      <p className="fixture-boundary"><strong>Fixture boundary:</strong> no SignLatch provider-effect request, signing action, or credit use can originate here. Hosting infrastructure may emit operational telemetry.</p>
    </section>
  );
}
