import type { LeasedDispatch, PostgresWorkflowStore } from "./postgres-store";
import type { ESignResult, FoxitESignAdapter } from "../foxit/esign-adapter";
import type { ESignDispatchStore } from "./esign-dispatch-store";

export type DispatchResult =
  | { status: "sent"; providerEnvelopeId: string }
  | { status: "safe-retry"; errorCode: string }
  | { status: "ambiguous" };

export interface ESignDispatchAdapter {
  send(lease: LeasedDispatch): Promise<DispatchResult>;
}

export async function processNextExactDispatch(store: ESignDispatchStore, adapter: { send(lease: NonNullable<Awaited<ReturnType<ESignDispatchStore["leaseNext"]>>>): Promise<ESignResult> }, workerId: string, now: Date) {
  const lease=await store.leaseNext(workerId,now,120);if(!lease)return "idle" as const;let result:ESignResult;try{result=await adapter.send(lease);}catch{result={status:"ambiguous",diagnostic:{phase:"request",code:"adapter-exception"}};}
  if(result.status==="sent"){await store.markSent(lease,result.providerEnvelopeId,result.correlationId);return "sent" as const;}
  if(result.status==="safe-retry"){
    if(lease.attempt_count>=3){await store.markDenied(lease,`retry-exhausted:${result.errorCode}`);return "denied" as const;}
    await store.releaseSafeRetry(lease,result.errorCode,now,result.retryAfterMs,result.diagnostic);return "retry-scheduled" as const;
  }
  if(result.status==="denied"){await store.markDenied(lease,result.errorCode);return "denied" as const;}
  await store.markReconcile(lease,"correlationId" in result?result.correlationId:undefined,"diagnostic" in result?result.diagnostic:undefined,now);return "reconcile" as const;
}

export async function reconcileExactDispatch(store: ESignDispatchStore, adapter: FoxitESignAdapter, dispatch:{dispatchId:string;idempotencyKey:string}) {
  const found=await adapter.findByCorrelation(dispatch.idempotencyKey);if(!found)return "unresolved" as const;await store.resolveReconciliation(dispatch.dispatchId,found.providerEnvelopeId);return "sent" as const;
}

export async function processNextReconciliation(
  store: ESignDispatchStore,
  adapter: Pick<FoxitESignAdapter, "findByCorrelation">,
  workerId: string,
  now: Date,
  delayForAttempt: (attempt: number) => number,
) {
  const lease = await store.leaseNextReconciliation(workerId, now, 120);
  if (!lease) return { status: "idle" as const };
  let found: { providerEnvelopeId: string } | null;
  try {
    found = await adapter.findByCorrelation(lease.idempotency_key);
  } catch {
    const retry = await store.releaseUnresolvedReconciliation(lease, now, delayForAttempt(lease.reconciliation_attempt_count), "lookup-failed");
    return { status: "lookup-failed" as const, workflowId: lease.workflow_id, attempt: lease.reconciliation_attempt_count, reasonCode: retry.reasonCode };
  }
  if (found) {
    await store.resolveReconciliation(lease.dispatch_id, found.providerEnvelopeId, { leasedBy: lease.leasedBy, reconciliation_lease_generation: lease.reconciliation_lease_generation, tenant_id: lease.tenant_id, now });
    return { status: "resolved" as const, workflowId: lease.workflow_id, attempt: lease.reconciliation_attempt_count };
  }
  const retry = await store.releaseUnresolvedReconciliation(lease, now, delayForAttempt(lease.reconciliation_attempt_count), "envelope-not-observed");
  return { status: "unresolved" as const, workflowId: lease.workflow_id, attempt: lease.reconciliation_attempt_count, reasonCode: retry.reasonCode };
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
    await store.markSent(lease, result.providerEnvelopeId);
    return "sent";
  }

  if (result.status === "safe-retry" && lease.attemptCount < options.maxAttempts) {
    const retryAt = new Date(now.getTime() + options.retryDelayMs(lease.attemptCount));
    await store.releaseSafeFailure(lease, retryAt, result.errorCode);
    return "retry-scheduled";
  }

  await store.markAmbiguous(lease);
  return "reconcile";
}
