import assert from "node:assert/strict";
import test from "node:test";
import { nextLifecycle } from "../src/server/provider/lifecycle";

test("out-of-order lifecycle is monotonic and completed remains nonterminal", () => {
  assert.equal(nextLifecycle("viewed", "sent"), "viewed");
  assert.equal(nextLifecycle("sent", "completed"), "completed");
  assert.equal(nextLifecycle("completed", "executed"), "executed");
  assert.equal(nextLifecycle("completed", "cancelled"), "cancelled");
  assert.equal(nextLifecycle("executed", "cancelled"), "executed");
  assert.equal(nextLifecycle("cancelled", "executed"), "cancelled");
});
