# SignLatch submission draft

SignLatch is an authority layer for AI-assisted supplier agreements. It structures
intent, produces a deterministic review with Foxit PDF Services, and binds a distinct
human approval to the exact artifact, recipients, fields, findings, intent, and
provenance. Any material mutation invalidates authority; restoring values cannot revive
it. A separate dispatcher rehashes the bytes and atomically consumes approval before a
single idempotent Foxit eSign operation can be queued.

Implemented and fixture-demonstrated: the exact approval latch, five-category attack
matrix, role separation, tenant isolation, provider budgets, fail-closed reconciliation,
webhook authentication, lifecycle monotonicity, and evidence privacy checks.

Live-demonstrated under a one-envelope authorization: the Foxit eSign Fusion credential
boundary, controlled dispatch to a consenting recipient, human signing, authenticated
activity reconciliation, and final-document verification. Foxit reported the envelope as
executed; SignLatch imported eight lifecycle events and independently validated and hashed
the 60,071-byte executed PDF before marking the workflow complete. The public evidence
contains hashes and lifecycle facts but excludes the recipient, provider ID, signature and
document contents.

SignLatch is technical workflow protection, not legal advice and not a claim that an
electronic signature is legally sufficient in every jurisdiction.
