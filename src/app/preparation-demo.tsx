"use client";

import { useState, type FormEvent } from "react";

import { PUBLIC_SHOWCASE } from "@/core/evidence/showcase";

type PreparationResult = {
  artifact: { sha256: string; size: number; url: string };
  manifest: {
    manifestSha256: string;
    calls: Array<{ sequence: number; tool: string; taskId?: string }>;
  };
  authority: { signingEnabled: false; reason: string };
};

const DEFAULT_PROMPT = `SUPPLIER AGREEMENT DRAFT

Buyer: Acme Procurement
Supplier: Example Components Ltd.
Purpose: Evaluation draft prepared through Foxit PDF Services.
Payment terms: Net 30.
Authority notice: This draft is not approved and must not be sent for signature without explicit human approval.`;

export function PreparationDemo({ authenticated = false, authenticationAvailable = false, csrfToken = "" }: { authenticated?: boolean; authenticationAvailable?: boolean; csrfToken?: string }) {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [result, setResult] = useState<PreparationResult | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/prepare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
          "X-SignLatch-CSRF": csrfToken,
        },
        body: JSON.stringify({ prompt }),
      });
      const payload = (await response.json()) as PreparationResult | { error?: string };
      if (!response.ok || !("artifact" in payload)) {
        throw new Error("error" in payload ? payload.error : "Foxit preparation failed");
      }
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Foxit preparation failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="demo" className="demo shell" aria-labelledby="demo-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Foxit MCP authority boundary</p>
          <span className="live-proof">Public fixture · live operation separately gated</span>
        </div>
        <h2 id="demo-title">The fixture behind the approval.</h2>
      </div>

      <div className={`demo-grid ${!authenticated ? "demo-grid-public" : ""}`}>
        {!authenticated ? (
          <div className="prompt-panel" aria-label="Read-only public fixture">
            <span className="live-proof">Sanitized real fixture</span>
            <h3>{PUBLIC_SHOWCASE.request}</h3>
            <dl className="fixture-facts">
              <div><dt>Artifact SHA-256</dt><dd><code>{PUBLIC_SHOWCASE.artifactSha256}</code></dd></div>
              <div><dt>Recipient</dt><dd>{PUBLIC_SHOWCASE.recipient}</dd></div>
              <div><dt>Provenance</dt><dd>{PUBLIC_SHOWCASE.provenance.join(" → ")}</dd></div>
              <div><dt>Authority</dt><dd>{PUBLIC_SHOWCASE.findings.join(" · ")}</dd></div>
            </dl>
            <a className="button button-primary fixture-next" href="#fixture-approval-title">Continue to human approval</a>
            {authenticationAvailable ? (
              <a className="button button-secondary" href="/api/auth/login">Sign in for the private workspace</a>
            ) : (
              <p className="latch-reason">Private workspace access is not enabled in this deployment.</p>
            )}
          </div>
        ) : (
        <form className="prompt-panel" onSubmit={submit}>
          <label htmlFor="document-prompt">Document request</label>
          <textarea
            id="document-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={32_000}
            disabled={pending}
          />
          <div className="prompt-actions">
            <p>Creates one PDF through Foxit PDF Services. It never invokes eSign.</p>
            <button type="submit" disabled={pending || !prompt.trim()}>
              {pending ? "Preparing with Foxit…" : "Prepare PDF · 1 credit"}
            </button>
          </div>
          {error ? <p className="demo-error" role="alert">{error}</p> : null}
        </form>
        )}

        <div className="proof-panel" aria-live="polite">
          {result ? (
            <>
              <iframe title="Foxit-prepared PDF" src={result.artifact.url} />
              <dl className="proof-facts">
                <div><dt>Artifact SHA-256</dt><dd>{result.artifact.sha256}</dd></div>
                <div><dt>Provenance manifest</dt><dd>{result.manifest.manifestSha256}</dd></div>
                <div><dt>Foxit operations</dt><dd>{result.manifest.calls.map((call) => call.tool).join(" → ")}</dd></div>
              </dl>
              <button className="latched-button" type="button" disabled>
                Send for signature · Latched
              </button>
              <p className="latch-reason">{result.authority.reason}</p>
            </>
          ) : authenticated ? (
            <div className="proof-empty">
              <span>01</span>
              <h3>No artifact prepared yet</h3>
              <p>The PDF, its exact hash and Foxit provenance will appear here.</p>
            </div>
          ) : (
            <div className="public-boundary-note">
              <span aria-hidden="true">⌁</span>
              <div><h3>Public showcase is read-only</h3><p>No control here can consume Foxit credits, access private artifacts or contact a recipient.</p></div>
              <strong>0 provider effects</strong>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
