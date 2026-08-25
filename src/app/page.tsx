import { PreparationDemo } from "./preparation-demo";

const workflow = [
  { step: "01", title: "Prepare", description: "The agent turns a plain request into a reviewable document with Foxit MCP." },
  { step: "02", title: "Inspect", description: "Deterministic checks bind the exact PDF hash, recipients, and Foxit provenance." },
  { step: "03", title: "Approve", description: "A person sees the exact artifact and unlocks the irreversible handoff." },
  { step: "04", title: "Sign", description: "Foxit eSign returns the executed document with its audit trail." },
];

const safeguards = [
  "No autonomous signature dispatch",
  "Exact-document approval",
  "Recipient set binding",
  "Verifiable eSign audit trail",
];

export default function Home() {
  return (
    <main>
      <section className="hero shell">
        <nav className="nav" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="SignLatch home">
            <span className="brand-mark" aria-hidden="true">SL</span>
            <span>SignLatch</span>
          </a>
          <div className="nav-links"><a className="nav-link" href="#demo">Live demo</a><a className="nav-link" href="#architecture">Architecture</a></div>
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

      <PreparationDemo />

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
