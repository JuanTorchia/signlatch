import { cookies } from "next/headers";
import Link from "next/link";

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
  if (session) {
    return <main className="workspace-home">
      <nav className="nav shell" aria-label="Workspace navigation">
        <Link className="brand" href="/" aria-label="SignLatch workspace"><span className="brand-mark" aria-hidden="true">SL</span><span>SignLatch</span></Link>
        <div className="nav-links"><a className="nav-link" href="#agreements">My agreements</a><form action="/api/auth/signout" method="post"><button className="nav-link" type="submit">Sign out</button></form></div>
      </nav>
      <section className="workspace-hero shell">
        <p className="eyebrow">Private workspace</p>
        <h1>Your agreements</h1>
        <p className="lede">Open an agreement to review the PDF, confirm who will receive it, and decide whether it can move forward.</p>
      </section>
      <AgreementsList workflows={workflows} />
      <section className="workspace-help shell" aria-labelledby="workspace-help-title">
        <div><p className="step-label">How it works</p><h2 id="workspace-help-title">Nothing is sent by surprise</h2></div>
        <ol><li><strong>Review</strong><span>Read the PDF and verify the recipient.</span></li><li><strong>Approve</strong><span>Lock that exact version for 15 minutes.</span></li><li><strong>Send</strong><span>A separate action emails it through Foxit.</span></li></ol>
      </section>
    </main>;
  }
  return (
    <main>
      <section className="hero shell">
        <nav className="nav" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="SignLatch home">
            <span className="brand-mark" aria-hidden="true">SL</span>
            <span>SignLatch</span>
          </a>
          <div className="nav-links">
            <a className="nav-link" href={session ? "#agreements" : "#demo"}>{session ? "My agreements" : "Try the demo"}</a>
            <a className="nav-link" href="#how-it-works">How it works</a>
            <a className="nav-link nav-link-desktop" href="https://github.com/JuanTorchia/signlatch">GitHub</a>
            {session ? <form action="/api/auth/signout" method="post"><button className="nav-link" type="submit">Sign out</button></form> : authenticationAvailable ? <a className="nav-link" href="/api/auth/login">Sign in</a> : <span className="nav-link" aria-label="Private access unavailable">Fixture mode</span>}
          </div>
        </nav>

        <div id="top" className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">A safety layer for document automation</p>
            <h1>Stop the wrong document before it reaches a signer.</h1>
            <p className="lede">
              SignLatch sits between an AI agent and Foxit eSign. A person verifies
              the PDF, recipient and signature fields—then releases only that exact version.
            </p>
            <p className="hero-audience">For legal operations, procurement and document teams</p>
            <div className="hero-actions">
              <a className="button button-primary" href={session ? "#agreements" : "#demo"}>{session ? "Open my agreements" : "Try the safe approval simulation"}</a>
              <a className="button button-secondary" href="#how-it-works">See how it works</a>
            </div>
          </div>

          <article className="release-checkpoint" aria-labelledby="checkpoint-title">
            <div className="checkpoint-header">
              <div><span className="checkpoint-kicker">Release checkpoint</span><h2 id="checkpoint-title">Needs your review</h2></div>
              <span className="checkpoint-lock" aria-label="Sending is locked">Locked</span>
            </div>
            <div className="checkpoint-document">
              <span className="document-icon" aria-hidden="true">PDF</span>
              <div><strong>Supplier Agreement</strong><span>Example Components · prepared by agent</span></div>
            </div>
            <dl className="checkpoint-facts">
              <div><dt>Send to</dt><dd>{PUBLIC_SHOWCASE.recipient}</dd></div>
              <div><dt>Signature fields</dt><dd>2 fields on page 1</dd></div>
              <div><dt>Terms</dt><dd>Net 30 payment terms</dd></div>
            </dl>
            <div className="checkpoint-warning"><span aria-hidden="true">!</span><p><strong>The agent cannot send this.</strong><br />A person must approve the exact document and recipient first.</p></div>
            <a className="checkpoint-action" href="#demo">Review before sending <span aria-hidden="true">→</span></a>
            <p className="checkpoint-footnote">If any bound material fact changes, SignLatch cancels the approval.</p>
          </article>
        </div>
      </section>

      <section id="how-it-works" className="value-strip shell" aria-label="How SignLatch changes document automation">
        <div><span>01</span><strong>Agent prepares</strong><small>Draft the PDF and place fields with Foxit MCP.</small></div>
        <i aria-hidden="true">→</i>
        <div className="value-strip-human"><span>02</span><strong>Human verifies</strong><small>Check the exact file, recipient, terms and fields.</small></div>
        <i aria-hidden="true">→</i>
        <div><span>03</span><strong>Foxit sends</strong><small>Release only the version that was approved.</small></div>
      </section>

      <PreparationDemo authenticated={Boolean(session)} authenticationAvailable={authenticationAvailable} csrfToken={csrfToken} />
      {!session && <FixtureApprovalDemo />}

      <aside className="evidence-separation shell" aria-label="Public demo and live proof boundary">
        <strong>Two separate evidence tracks</strong>
        <p>The interactive demo above is an effect-free public fixture. The proof below comes from a separate, previously authorized Foxit sandbox envelope; using the fixture cannot send email or consume credits.</p>
      </aside>

      <section id="live-proof" className="live-completion shell" aria-labelledby="live-proof-title">
        <div className="section-heading">
          <div><p className="eyebrow">Authenticated Foxit eSign proof</p><span className="live-proof">Live demonstrated</span></div>
          <div><h2 id="live-proof-title">One envelope. Human-signed. Verified from Foxit activity.</h2><p className="demo-intro">SignLatch retrieved the real envelope state from Foxit&apos;s authenticated activity API, imported eight lifecycle events, downloaded the executed PDF, validated its structure, and independently hashed the retrieved bytes before marking the workflow complete.</p></div>
        </div>
        <dl className="completion-proof-grid">
          <div><dt>Provider lifecycle</dt><dd>Executed</dd><small>Authenticated activity history</small></div>
          <div><dt>Timeline events</dt><dd>8</dd><small>Sanitized and digest-bound</small></div>
          <div><dt>Executed PDF</dt><dd>60,071 bytes</dd><small>Validated before completion</small></div>
          <div><dt>SHA-256</dt><dd><code>058c3e619e459d01…6175e79</code></dd><small>Content-addressed evidence</small></div>
        </dl>
        <p className="completion-privacy-note"><strong>Privacy boundary:</strong> the public proof exposes the executed-file hash and aggregate lifecycle facts—not recipient data, provider or event identifiers, signatures, or document contents.</p>
        <div className="completion-proof-actions">
          <a className="button" href="https://github.com/JuanTorchia/signlatch/blob/main/evidence/live-completion-public-2026-08-29.json">View sanitized evidence</a>
          <a className="button" href="https://github.com/JuanTorchia/signlatch/tree/main/src/server/provider">Inspect completion source</a>
        </div>
      </section>

      <section id="workflow" className="workflow shell">
        <div className="section-heading">
          <p className="eyebrow">Technical event log</p>
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
          <div><span>Commitment side</span><strong>Foxit eSign · verified live</strong><small>A real envelope was sent, signed and executed under a one-envelope budget.</small></div>
        </div>
      </section>

      <footer className="footer shell">
        <span>SignLatch · Building in public for API World 2026</span>
        <span>Fixture-safe demo backed by a verified Foxit eSign journey.</span>
      </footer>
    </main>
  );
}

type WorkspaceWorkflow = Awaited<ReturnType<ReviewStore["listOwnedWorkflows"]>>[number];

function AgreementsList({ workflows }: { workflows: WorkspaceWorkflow[] }) {
  return <section id="agreements" className="agreements shell" aria-labelledby="agreements-title">
    <div className="workspace-section-heading"><h2 id="agreements-title">Needs your attention</h2><span>{workflows.length} {workflows.length === 1 ? "agreement" : "agreements"}</span></div>
    {workflows.length ? <div className="agreement-list">{workflows.map((workflow) => <a className="agreement-row" href={`/workflows/${workflow.workflowId}`} key={workflow.workflowId}>
      <div><strong>{workflow.supplierName || "Supplier agreement"}</strong><span>{workflow.recipientEmail ?? "Recipient pending"}</span></div>
      <span className={`status ${workflow.state === "approved" ? "status-approved" : "status-blocked"}`}>{humanWorkflowState(workflow.state)}</span>
      <time dateTime={workflow.updatedAt.toISOString()}>{workflow.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time>
      <b>Review agreement →</b>
    </a>)}</div> : <p className="workspace-empty">No agreements need your attention.</p>}
  </section>;
}

function humanWorkflowState(state: string): string {
  if (state === "approved") return "Approved, not sent";
  if (state === "review") return "Needs approval";
  if (state === "sent") return "Sent";
  if (state === "completed") return "Signed and completed";
  if (state === "failed") return "Failed, not sent";
  if (state === "reconcile") return "Delivery unconfirmed";
  return "In progress";
}
