"use client";

import { useState } from "react";

const categories = ["artifact", "recipient", "field", "finding", "intent"] as const;
type Status = "review" | "approved" | "invalidated";

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
      <p className="eyebrow">Fixture-demonstrated · zero external effects</p>
      <h2 id="fixture-approval-title">Try the exact approval latch</h2>
      <p role="status" aria-live="polite">{message}</p>
      <fieldset>
        <legend>Material mutation matrix</legend>
        {categories.map((item) => (
          <button className="button button-secondary" type="button" key={item} onClick={() => { setCategory(item); setStatus("invalidated"); setReviewed(false); }}>
            Mutate {item}
          </button>
        ))}
      </fieldset>
      <label>
        <input type="checkbox" checked={reviewed} disabled={status !== "review"} onChange={(event) => setReviewed(event.target.checked)} />{" "}
        I reviewed the exact fixture snapshot.
      </label>
      <button className="button button-primary" type="button" disabled={status !== "review" || !reviewed} onClick={() => setStatus("approved")}>
        Approve exact fixture · local simulation
      </button>
      {status !== "review" ? <button className="button button-secondary" type="button" onClick={reset}>Start a fresh fixture review</button> : null}
      <p>No API request, provider call, signing action, or credit use can originate here.</p>
    </section>
  );
}
