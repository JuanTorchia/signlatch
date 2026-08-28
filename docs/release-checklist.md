# Separate release decisions

All boxes require a fresh human go/no-go; one approval does not authorize another.

- [x] Deploy revision `cbfc34af857b96db940ef704ded9c4edf96a50f3` and six
  migrations — explicitly authorized and completed on 2026-08-26 UTC.
- [x] Publish the sanitized fixture evidence already bound to that revision — explicitly
  authorized and completed on 2026-08-26 UTC.
- [x] Deploy fixture UI and webhook hardening revision
  `6694bbf11e4d88e2fe03eeeb6780995de8e64982` with every Foxit effect gate
  remaining disabled — explicitly authorized and completed on 2026-08-26 UTC.
- [x] Enable one bounded Foxit PDF preparation operation — explicitly authorized,
  completed through the official Foxit MCP server and recorded under `evidence/m3/`.
- [x] Enable and execute one bounded Foxit eSign dispatch to the named consenting signer —
  explicitly authorized and completed on 2026-08-28 UTC.
- [x] Reconcile authenticated Foxit activity and independently validate/hash the executed
  PDF — explicitly authorized and completed on 2026-08-28 UTC. The webhook was not
  required because the authenticated activity API supplied the lifecycle record.
- [ ] Publish the English or Spanish build post.
- [ ] Publish the demo video.
- [ ] Submit the competition form and accept its terms.

Record revision, exact artifact/review digest, account, recipient, budget, expiry, and
decision timestamp for live provider actions. A technical PASS never checks these boxes.

The checked decisions above do not authorize another provider operation. Publication of
posts/video and the competition submission remain separate human go/no-go decisions.
