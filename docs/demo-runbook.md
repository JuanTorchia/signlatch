# Ten-minute judge runbook

## Safe fixture journey

1. Run `pnpm install --frozen-lockfile`, `pnpm check`, and the isolated integration suite.
2. Open the public fixture showcase and confirm it says fixture-demonstrated and signing disabled.
3. Run `pnpm test:harness`; inspect `evidence/approval-harness.json`.
4. Show that all five material mutations are denied and restoration still needs reapproval.
5. Run `pnpm evidence:privacy-scan` and `pnpm evidence:verify`.

This path makes no provider call, sends no envelope, and consumes no credits.

## Live step — explicit authorization required

Do not enable live preparation, eSign enqueue, a dispatch worker, or webhook exposure
during the fixture demo. A live proof requires the bounded checklist in
`docs/foxit-esign-setup.md`, current credentials, one consenting signer, and immediate
human authorization. A queued operation is not proof of provider delivery. Only a
correlated provider envelope plus authenticated events and independently hashed final
bytes may be described as live-demonstrated.
