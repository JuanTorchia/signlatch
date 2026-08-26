import type { FoxitLifecycle } from "./foxit-webhook";

const rank: Record<FoxitLifecycle, number> = {
  created: 0,
  sent: 1,
  viewed: 2,
  signed: 3,
  completed: 4,
  executed: 5,
  declined: 5,
  cancelled: 5,
};
const terminal = new Set<FoxitLifecycle>(["executed", "declined", "cancelled"]);

export function nextLifecycle(
  current: FoxitLifecycle,
  event: FoxitLifecycle,
): FoxitLifecycle {
  if (terminal.has(current)) return current;
  if (rank[event] < rank[current]) return current;
  return event;
}
