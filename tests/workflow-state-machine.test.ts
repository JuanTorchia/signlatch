import assert from "node:assert/strict";
import test from "node:test";

import { assertWorkflowTransition } from "../src/core/workflow/state-machine";

test("the authority path permits only explicit transitions", () => {
  assert.doesNotThrow(() => assertWorkflowTransition("review", "approved"));
  assert.doesNotThrow(() => assertWorkflowTransition("approved", "dispatching"));
  assert.doesNotThrow(() => assertWorkflowTransition("dispatching", "sent"));
  assert.doesNotThrow(() => assertWorkflowTransition("sent", "completed"));
});

test("the agent cannot skip human approval", () => {
  assert.throws(() => assertWorkflowTransition("review", "dispatching"), /not allowed/);
});

test("ambiguous delivery must reconcile instead of retrying from approved", () => {
  assert.doesNotThrow(() => assertWorkflowTransition("dispatching", "reconcile"));
  assert.throws(() => assertWorkflowTransition("reconcile", "dispatching"), /not allowed/);
});

test("terminal workflows fail closed", () => {
  assert.throws(() => assertWorkflowTransition("completed", "review"), /not allowed/);
  assert.throws(() => assertWorkflowTransition("failed", "dispatching"), /not allowed/);
});
