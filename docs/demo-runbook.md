# Ten-minute judge runbook

## Safe fixture journey

1. Run `pnpm install --frozen-lockfile`, `pnpm check`, and the isolated integration suite.
2. Open the public fixture showcase and confirm it says fixture-demonstrated and signing disabled.
3. Run `pnpm test:harness`; inspect `evidence/approval-harness.json`.
4. Show that all five material mutations are denied and restoration still needs reapproval.
5. Run `pnpm evidence:privacy-scan` and `pnpm evidence:verify`.

This path makes no provider call, sends no envelope, and consumes no credits.

## Recorded live proof

The public page now presents the sanitized result of the separately authorized live
journey. Show `evidence/live-completion-2026-08-28.json`: Foxit reached `executed`,
SignLatch imported eight authenticated lifecycle events, and the validated final PDF is
60,071 bytes with SHA-256
`058c3e619e459d016ac779ba07bab0dca4891e70a49c4c0365e00fc526175e79`.

Do not enable live preparation, enqueue, dispatch or completion workers during judging.
The recorded proof is sufficient and no new provider effect is authorized. The executed
document itself remains private.
