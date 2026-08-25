export const workflowStates = [
  "preparing",
  "review",
  "approved",
  "dispatching",
  "reconcile",
  "sent",
  "failed",
  "completed",
] as const;

export type WorkflowState = (typeof workflowStates)[number];

const allowedTransitions: Readonly<Record<WorkflowState, readonly WorkflowState[]>> = {
  preparing: ["review"],
  review: ["approved"],
  approved: ["review", "dispatching"],
  dispatching: ["sent", "reconcile"],
  reconcile: ["sent", "failed"],
  sent: ["completed"],
  failed: [],
  completed: [],
};

export function assertWorkflowTransition(from: WorkflowState, to: WorkflowState): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`Workflow transition ${from} -> ${to} is not allowed`);
  }
}
