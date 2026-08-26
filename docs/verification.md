# Verification record

Only sanitized command outcomes belong here. Provider identifiers, connection strings,
credentials, document text, and private paths are excluded.

## 2026-08-26 final fixture gate

- clean detached worktree at `9cb3e0a`, `pnpm install --frozen-lockfile`: PASS.
- `pnpm check`, two consecutive clean-worktree runs: PASS — 65 unit tests, lint,
  type generation, TypeScript, and production build on each run.
- isolated PostgreSQL suite, two consecutive clean-worktree runs: PASS — 23 tests each.
- clean-worktree `pnpm test:browser`: PASS — six fixture/browser boundary tests.
- clean-worktree attack harness: PASS — five mutation classes plus restoration denial.
- clean-worktree evidence verification and link scan: PASS — one manifest entry and
  zero broken local Markdown links.
- `pnpm evidence:privacy-scan`: PASS — zero findings in staged JSON evidence.

No live eSign claim is recorded here. The sandbox dispatch, signed completion evidence,
deployment, media publication, and submission remain explicit human decisions.

## 2026-08-26 pre-sandbox hardening gate

- checksum-tracked migration runner, two consecutive executions against the disposable
  PostgreSQL database: PASS; the second execution applied no migrations.
- `pnpm check`: PASS — 67 unit tests, lint, type generation, TypeScript, and production build.
- isolated PostgreSQL suite: PASS — 27 integration tests, including one-unit dispatch
  budget accounting and expired-lease recovery into reconciliation.
- `pnpm test:browser`: PASS — six browser boundary tests.
- attack harness, privacy scan, manifest verification, and link scan: PASS — five
  mutation classes, zero privacy findings, one fixture manifest entry, zero broken links.

These are fixture and local infrastructure results. They do not satisfy the live sandbox
journey or authorize a provider call.

The completion evidence path now derives the executed digest and timeline digest from
correlated database state, hashes provider identifiers, refuses manual claimed hashes,
and stages only to an absolute private path behind an independent gate. Its fixture
tests are included in the counts above; no live-completion claim was created.

## 2026-08-26 post-deployment reversible completion audit

- `pnpm check`: PASS — 70 unit tests after the operator gate parser correction,
  lint, type generation, TypeScript, and production build.
- isolated PostgreSQL 17 suite: PASS — 27 integration tests; the disposable
  container was removed after execution.
- `pnpm operations:restore-probe`: PASS — five required schema boundaries found.
- `pnpm test:browser`: PASS — six browser tests, including 320-pixel keyboard use,
  judge journey, dispatch denial, and truthful fixture completion.
- `pnpm test:harness`, `pnpm test:attack`, and `pnpm test:contract`: PASS — five
  mutation categories, 19 attack tests, and four provider-boundary contracts.
- evidence verification, privacy scan, and link validation: PASS — zero privacy
  findings and zero broken links across 29 Markdown files.
- operator commands with fictitious identifiers and all live gates absent: PASS —
  dispatch, completion retrieval, and completion evidence each failed closed before
  database or provider access.

The documented `pnpm operator:live-proof -- --workflow ...` invocation previously
misparsed pnpm's separator. The parser now accepts exactly one optional separator,
rejects unknown/duplicate/malformed arguments and budgets other than one, validates
lowercase SHA-256 values, and checks the exact immediate authorization id before opening
the database. No provider call was made during this audit.

## 2026-08-26 live-readiness preflight

- The masked Coolify inventory contained 24 production/preview entries covering
  session, database, storage, public showcase, body limit, and four closed effect
  gates. It contained no GitHub OAuth or `FOXIT_ESIGN_*` variable names.
- `pnpm operator:live-preflight -- --phase all` was added as a network-free,
  value-redacting prerequisite. It exits nonzero until configuration is complete and
  also exits nonzero if any effect gate is already open before authorization.
- `pnpm test`: PASS — 74 tests, including missing-name redaction, dispatch/completion
  phase separation, open-gate detection, and pnpm separator parsing.
- `pnpm typecheck`: PASS.

This proves configuration is not ready for T074/T087 while all effect gates remain
closed. It does not authorize adding credentials, exposing the webhook, or dispatching.

## 2026-08-26 Foxit Fusion contract correction

- `pnpm check`: PASS — 76 unit tests, lint, type generation, TypeScript, and
  production build.
- Foxit contract suite: PASS — six tests covering Fusion client credentials,
  `createfolder`, exact approved PDF bytes, party-field binding, canonical Base64
  webhook HMAC, rotation, official event names, and malformed input denial.
- isolated PostgreSQL 17 suite: PASS — 27 integration tests with migration `0008`
  applied; the disposable container was removed after execution.
- `pnpm test:browser`: PASS — six browser boundary tests, including a forged query
  signature rejected without presenting fixture completion as verified.
- approval harness: PASS — five mutation and restoration-denial results regenerated.

The provider lifecycle now treats `folder_completed` as nonterminal evidence and
requires verified `folder_executed` before executed-document retrieval. These are
local contract and fixture results only; no live folder was created and no signature
request was sent.

## 2026-08-26 post-deploy audit remediation

- Exact dispatch now distinguishes bounded known-safe retry, permanent provider
  denial, and ambiguous reconciliation; safe retries become permanent after three
  attempts. PostgreSQL integration tests cover all dispositions and budget release.
- A completion insert conflict now rereads and returns the canonical executed-document
  row instead of reporting a losing worker's local hash.
- The public fixture demonstrates a positive local approval followed by mutation
  invalidation, while generating zero application-effect requests.
- Unconfigured OAuth controls are hidden, fixture/live copy is explicit, and the
  production build emits CSP with `frame-ancestors`, X-Frame-Options, Referrer-Policy,
  and Permissions-Policy.
- `pnpm check`: PASS — 76 unit tests, lint, type generation, TypeScript, and build.
- isolated PostgreSQL 17: PASS — 31 integration tests; disposable container removed.
- Playwright: PASS — six browser tests, including positive latch and read-only public
  journey. Attack and Foxit contract suites remain 19/19 and 6/6.

This remediation is local and not deployed. It does not authorize a push, deployment,
OAuth configuration, Foxit call, or signing journey.

## 2026-08-26 webhook freshness hardening

- Signed provider events older than seven days fail closed by default.
- Signed provider events more than five minutes in the future fail closed.
- Boundary timestamps remain accepted, and an operator can provide an explicit
  wider retry window without weakening the production default.
- `pnpm test:contract`: PASS — eight contract tests, including stale, future-dated,
  exact-boundary, and explicit retry-window cases.
- `pnpm typecheck` and `pnpm lint`: PASS.

This closes the local webhook freshness finding. It does not claim a live Foxit
event and does not authorize enabling provider-effect gates.

## 2026-08-26 public fixture UI and UX hardening

- The ceremony now separates application state from the provider state and keeps
  `Locked · Zero SignLatch/provider effects` visible during review, simulated approval and
  invalidation.
- Fixture controls no longer describe a provider release; the positive path records a
  browser-only simulated approval.
- `pnpm test:browser`: PASS — 14 tests covering all five mutation categories, clean
  recovery, zero application-effect requests, keyboard operation, visible focus,
  console/page errors, and horizontal overflow at 320, 390 and 1440 CSS pixels.
- `pnpm check`: PASS — 78 unit tests, lint, type generation, TypeScript and production
  build.

Full-page desktop and mobile screenshots were visually inspected and recorded in the
challenge evidence workspace. These results describe the local working tree; they are
not evidence that the current production deployment contains this UI revision.
