import assert from "node:assert/strict";
import test from "node:test";

import { processNextDispatch, type ESignDispatchAdapter } from "../src/server/workflow/outbox-worker";
import type { PostgresWorkflowStore } from "../src/server/workflow/postgres-store";

function storeFixture() {
  const calls: string[] = [];
  const lease = {
    outboxId: "outbox-1",
    workflowId: "workflow-1",
    tenantId: "tenant-1",
    approvalId: "approval-1",
    idempotencyKey: "signlatch:approval-1",
    payload: {},
    attemptCount: 1,
    workflowVersion: 3,
    leasedBy: "worker-1",
    leaseGeneration: 1,
  };
  const store = {
    async leaseNextDispatch() {
      calls.push("lease");
      return lease;
    },
    async markSent() {
      calls.push("sent");
      return 4;
    },
    async releaseSafeFailure() {
      calls.push("retry");
    },
    async markAmbiguous() {
      calls.push("reconcile");
      return 4;
    },
  } as unknown as PostgresWorkflowStore;
  return { store, calls };
}

const options = {
  workerId: "worker-1",
  leaseSeconds: 30,
  maxAttempts: 3,
  retryDelayMs: (attempt: number) => attempt * 1_000,
};

test("a confirmed provider envelope completes the outbox item", async () => {
  const { store, calls } = storeFixture();
  const adapter: ESignDispatchAdapter = {
    async send() {
      return { status: "sent", providerEnvelopeId: "foxit-envelope-1" };
    },
  };
  assert.equal(await processNextDispatch(store, adapter, options, new Date()), "sent");
  assert.deepEqual(calls, ["lease", "sent"]);
});

test("only an explicitly safe pre-send failure is retried", async () => {
  const { store, calls } = storeFixture();
  const adapter: ESignDispatchAdapter = {
    async send() {
      return { status: "safe-retry", errorCode: "local-validation" };
    },
  };
  assert.equal(await processNextDispatch(store, adapter, options, new Date()), "retry-scheduled");
  assert.deepEqual(calls, ["lease", "retry"]);
});

test("unexpected adapter errors fail closed into reconciliation", async () => {
  const { store, calls } = storeFixture();
  const adapter: ESignDispatchAdapter = {
    async send() {
      throw new Error("connection reset after request write");
    },
  };
  assert.equal(await processNextDispatch(store, adapter, options, new Date()), "reconcile");
  assert.deepEqual(calls, ["lease", "reconcile"]);
});
