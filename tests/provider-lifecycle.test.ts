import assert from "node:assert/strict"; import test from "node:test"; import {nextLifecycle} from "../src/server/provider/lifecycle";
test("out-of-order lifecycle is monotonic",()=>{assert.equal(nextLifecycle("viewed","sent"),"viewed"); assert.equal(nextLifecycle("completed","declined"),"completed"); assert.equal(nextLifecycle("sent","completed"),"completed");});
