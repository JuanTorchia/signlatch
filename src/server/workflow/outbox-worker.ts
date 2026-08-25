import type { LeasedDispatch, PostgresWorkflowStore } from "./postgres-store";

export type DispatchResult =
  | { status: "sent"; providerEnvelopeId: string }
  | { status: "safe-retry"; errorCode: string }
  | { status: "ambiguous" };

export interface ESignDispatchAdapter {
  send(lease: LeasedDispatch): Promise<DispatchResult>;
}

export type WorkerOptions = {
  workerId: string;
  leaseSeconds: number;
  maxAttempts: number;
  retryDelayMs: (attemptCount: number) => number;
};

export async function processNextDispatch(
  store: PostgresWorkflowStore,
  adapter: ESignDispatchAdapter,
  options: WorkerOptions,
  now: Date,
): Promise<"idle" | "sent" | "retry-scheduled" | "reconcile"> {
  const lease = await store.leaseNextDispatch(
    options.workerId,
    now,
    options.leaseSeconds,
    options.maxAttempts,
  );
  if (!lease) return "idle";

  let result: DispatchResult;
  try {
    result = await adapter.send(lease);
  } catch {
    result = { status: "ambiguous" };
  }

  if (result.status === "sent") {
    await store.markSent(
      lease.workflowId,
      lease.tenantId,
      "dispatching",
      lease.workflowVersion,
      result.providerEnvelopeId,
    );
    return "sent";
  }

  if (result.status === "safe-retry" && lease.attemptCount < options.maxAttempts) {
    const retryAt = new Date(now.getTime() + options.retryDelayMs(lease.attemptCount));
    await store.releaseSafeFailure(lease, retryAt, result.errorCode);
    return "retry-scheduled";
  }

  await store.markAmbiguous(lease.workflowId, lease.tenantId, lease.workflowVersion);
  return "reconcile";
}
