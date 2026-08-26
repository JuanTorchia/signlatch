import { cookies } from "next/headers";

import { createCsrfToken, parseSession } from "@/server/auth/session";
import { PreparationDemo } from "./preparation-demo";
import { FixtureApprovalDemo } from "./fixture-approval-demo";

const workflow = [
  { step: "01", title: "Prepare", description: "The agent turns a plain request into a reviewable document with Foxit MCP." },
  { step: "02", title: "Inspect", description: "Deterministic checks bind the exact PDF hash, recipients, and Foxit provenance." },
  { step: "03", title: "Approve", description: "A person sees the exact artifact and unlocks the irreversible handoff." },
  { step: "04", title: "Sign", description: "The implemented Foxit eSign boundary awaits a separately authorized live proof with a consenting signer." },
];

const safeguards = [
  "No autonomous signature dispatch",
  "Exact-document approval",
  "Recipient set binding",
  "Verifiable eSign audit trail",
];

export default async function Home() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("signlatch_session")?.value;
  const secret = process.env.AUTH_SESSION_SECRET;
  const authenticationAvailable = Boolean(process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET && process.env.SIGNLATCH_GITHUB_OPERATORS);
  const session = sessionToken && secret ? parseSession(sessionToken, secret) : null;
  const csrfToken = session && sessionToken && secret ? createCsrfToken(sessionToken, secret) : "";
  return (
    <main>
      <section className="hero shell">
        <nav className="nav" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="SignLatch home">
            <span className="brand-mark" aria-hidden="true">SL</span>
            <span>SignLatch</span>
          </a>
          <div className="nav-links">
            <a className="nav-link" href="#demo">{session ? "Private workspace" : "Safe showcase"}</a>
            <a className="nav-link" href="#architecture">Architecture</a>
            {session ? <form action="/api/auth/signout" method="post"><button className="nav-link" type="submit">Sign out</button></form> : authenticationAvailable ? <a className="nav-link" href="/api/auth/login">Sign in</a> : <span className="nav-link" aria-label="Private access unavailable">Fixture mode</span>}
          </div>
        </nav>

        <div id="top" className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Human authority for agentic documents</p>
            <h1>Your agent can prepare it. Only you can release it.</h1>
            <p className="lede">
              SignLatch puts a visible, auditable human checkpoint between AI document work
              and electronic signature.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#workflow">See the boundary</a>
              <a className="button button-secondary" href="https://github.com/JuanTorchia/signlatch">
                Follow the build
              </a>
            </div>
            <ul className="safeguards" aria-label="Core safeguards">
              {safeguards.map((safeguard) => <li key={safeguard}>{safeguard}</li>)}
            </ul>
          </div>

          <div className="decision-card" aria-label="Example signing decision">
            <div className="card-bar">
              <span>Signing checkpoint</span>
              <span className="status status-blocked">Latched</span>
            </div>
            <div className="document-preview">
              <div className="document-line line-long" />
              <div className="document-line" />
              <div className="document-line line-medium" />
              <div className="risk-row">
                <span className="risk-icon" aria-hidden="true">!</span>
                <div>
                  <strong>Exact artifact hash captured</strong>
                  <p>Any byte or recipient change invalidates approval.</p>
                </div>
              </div>
              <div className="document-line line-long" />
              <div className="document-line line-short" />
            </div>
            <div className="approval-panel">
              <div><span className="label">Recipient</span><strong>alex@acme.example</strong></div>
              <button type="button" disabled>Send for signature</button>
            </div>
            <p className="card-note">Human approval required to unlatch this action.</p>
          </div>
        </div>
      </section>

      <PreparationDemo authenticated={Boolean(session)} authenticationAvailable={authenticationAvailable} csrfToken={csrfToken} />
      {!session && <FixtureApprovalDemo />}

      <section id="workflow" className="workflow shell">
        <div className="section-heading">
          <p className="eyebrow">Reversible until it matters</p>
          <h2>A clear authority boundary, not another black-box agent.</h2>
        </div>
        <div className="workflow-grid">
          {workflow.map((item) => (
            <article key={item.step} className="workflow-card">
              <span>{item.step}</span><h3>{item.title}</h3><p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="architecture" className="architecture shell">
        <div>
          <p className="eyebrow">Built for the Foxit challenge</p>
          <h2>MCP for preparation. Direct eSign for commitment.</h2>
        </div>
        <div className="architecture-path" aria-label="SignLatch architecture flow">
          <span>Prompt</span><i aria-hidden="true">→</i><span>Foxit MCP</span><i aria-hidden="true">→</i>
          <span>Policy engine</span><i aria-hidden="true">→</i><strong>Human latch</strong>
          <i aria-hidden="true">→</i><span>Foxit eSign</span>
        </div>
      </section>

      <footer className="footer shell">
        <span>SignLatch · Building in public for API World 2026</span>
        <span>Electronic signatures, accountable humans.</span>
      </footer>
    </main>
  );
}
