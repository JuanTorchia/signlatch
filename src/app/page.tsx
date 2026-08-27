import { cookies } from "next/headers";

import { createCsrfToken, parseSession } from "@/server/auth/session";
import { PreparationDemo } from "./preparation-demo";
import { FixtureApprovalDemo } from "./fixture-approval-demo";
import { PUBLIC_SHOWCASE } from "@/core/evidence/showcase";
import { database } from "@/server/database";
import { ReviewStore } from "@/server/workflow/review-store";

const authorityEvents = [
  { time: "09:41:02", event: "Foxit PDF prepared", state: "Reversible" },
  { time: "09:41:05", event: "Review digest created", state: "Bound" },
  { time: "09:42:11", event: "Human approval recorded", state: "Local fixture" },
  { time: "09:42:18", event: "Recipient mutated", state: "Invalidated" },
  { time: "09:42:18", event: "Provider dispatch", state: "Denied" },
];

export default async function Home() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("signlatch_session")?.value;
  const secret = process.env.AUTH_SESSION_SECRET;
  const authenticationAvailable = Boolean(process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET && process.env.SIGNLATCH_GITHUB_OPERATORS);
  const session = sessionToken && secret ? parseSession(sessionToken, secret) : null;
  const csrfToken = session && sessionToken && secret ? createCsrfToken(sessionToken, secret) : "";
  const workflows = session ? await new ReviewStore(database()).listOwnedWorkflows(session.tenantId, session.principalId) : [];
  return (
    <main>
      <section className="hero shell">
        <nav className="nav" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="SignLatch home">
            <span className="brand-mark" aria-hidden="true">SL</span>
            <span>SignLatch</span>
          </a>
          <div className="nav-links">
            <a className="nav-link" href={session ? "#agreements" : "#demo"}>{session ? "My agreements" : "Safe showcase"}</a>
            <a className="nav-link" href="#architecture">Architecture</a>
            {session ? <form action="/api/auth/signout" method="post"><button className="nav-link" type="submit">Sign out</button></form> : authenticationAvailable ? <a className="nav-link" href="/api/auth/login">Sign in</a> : <span className="nav-link" aria-label="Private access unavailable">Fixture mode</span>}
          </div>
        </nav>

        <div id="top" className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Document authority workbench</p>
            <h1>Your agent can prepare it. Only you can release it.</h1>
            <p className="lede">
              Inspect the exact document state an agent prepared. If any material fact
              changes, approval is invalidated before Foxit eSign can act.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href={session ? "#agreements" : "#fixture-approval-title"}>{session ? "Open my agreements" : "Inspect the exact approval"}</a>
              <a className="button button-secondary" href="https://github.com/JuanTorchia/signlatch">
                Follow the build
              </a>
            </div>
          </div>

          <div className="review-receipt" aria-label="Sanitized exact review snapshot">
            <div className="card-bar">
              <span>Supplier agreement · review 07</span>
              <span className="status status-blocked">Provider locked</span>
            </div>
            <dl className="receipt-facts">
              <div><dt>Artifact</dt><dd><code>{PUBLIC_SHOWCASE.artifactSha256.slice(0, 16)}…{PUBLIC_SHOWCASE.artifactSha256.slice(-8)}</code></dd></div>
              <div><dt>Recipient</dt><dd>{PUBLIC_SHOWCASE.recipient}</dd></div>
              <div><dt>Fields</dt><dd>2 signature fields</dd></div>
              <div><dt>Findings</dt><dd>1 authority finding</dd></div>
              <div><dt>Foxit source</dt><dd><code>pdf_from_text</code></dd></div>
              <div><dt>Provider</dt><dd><strong>LOCKED</strong></dd></div>
            </dl>
            <div className="receipt-rule"><span>Exact review digest</span><code>approval-v2 / bound</code></div>
            <a className="receipt-action" href="#fixture-approval-title">Open review ceremony <span aria-hidden="true">↓</span></a>
          </div>
        </div>
      </section>

      <PreparationDemo authenticated={Boolean(session)} authenticationAvailable={authenticationAvailable} csrfToken={csrfToken} />
      {session ? <section id="agreements" className="agreements shell" aria-labelledby="agreements-title">
        <div className="section-heading"><p className="eyebrow">Your workspace</p><h2 id="agreements-title">Agreements that need your attention</h2></div>
        {workflows.length ? <div className="agreement-list">{workflows.map((workflow) => <a className="agreement-row" href={`/workflows/${workflow.workflowId}`} key={workflow.workflowId}>
          <div><strong>{workflow.supplierName || "Supplier agreement"}</strong><span>{workflow.recipientEmail ?? "Recipient pending"}</span></div>
          <span className={`status ${workflow.state === "approved" ? "status-approved" : "status-blocked"}`}>{humanWorkflowState(workflow.state)}</span>
          <time dateTime={workflow.updatedAt.toISOString()}>{workflow.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time>
          <b>Open review →</b>
        </a>)}</div> : <p className="workspace-empty">No agreements yet. Prepare one above to start the review flow.</p>}
      </section> : null}
      {!session && <FixtureApprovalDemo />}

      <section id="workflow" className="workflow shell">
        <div className="section-heading">
          <p className="eyebrow">Authority event log</p>
          <h2>Every transition leaves a reason.</h2>
        </div>
        <ol className="authority-log">
          {authorityEvents.map((item) => <li key={`${item.time}-${item.event}`}><time>{item.time}</time><span>{item.event}</span><strong>{item.state}</strong></li>)}
        </ol>
      </section>

      <section id="architecture" className="architecture shell">
        <div>
          <p className="eyebrow">Enforcement boundary</p>
          <h2>Preparation and commitment never share authority.</h2>
        </div>
        <div className="boundary-table" aria-label="SignLatch authority boundary">
          <div><span>Reversible side</span><strong>Prompt → Foxit MCP → Policy checks</strong><small>May prepare and inspect. Cannot authorize.</small></div>
          <div className="boundary-latch"><span>Human latch</span><strong>Exact digest + recipient + intent</strong><small>Any material mutation invalidates approval.</small></div>
          <div><span>Commitment side</span><strong>Foxit eSign · live proof pending</strong><small>Separately gated, budgeted and operator-authorized.</small></div>
        </div>
      </section>

      <footer className="footer shell">
        <span>SignLatch · Building in public for API World 2026</span>
        <span>Fixture evidence, not marketing claims.</span>
      </footer>
    </main>
  );
}

function humanWorkflowState(state: string): string {
  if (state === "approved") return "Approved, not sent";
  if (state === "review") return "Needs approval";
  if (state === "sent" || state === "completed") return "Sent";
  return "In progress";
}
