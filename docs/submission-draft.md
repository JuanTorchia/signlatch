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

Implemented but not yet live-demonstrated: Foxit eSign Fusion credential boundary, controlled
dispatch, webhook persistence, and final-document verification. Live delivery and human
completion must only be claimed after one separately authorized sandbox journey.

SignLatch is technical workflow protection, not legal advice and not a claim that an
electronic signature is legally sufficient in every jurisdiction.
