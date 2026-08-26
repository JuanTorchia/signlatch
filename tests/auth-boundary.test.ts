import assert from "node:assert/strict";
import test from "node:test";

import {
  createCsrfToken,
  issueSession,
  parseSession,
  verifyCsrfToken,
} from "../src/server/auth/session";
import { can, requireCapability } from "../src/server/auth/authorize";

const secret = "s".repeat(64);

test("signed sessions reject mutation and expiry", () => {
  const token = issueSession({
    principalId: "principal-1",
    tenantId: "tenant-1",
    roles: ["operator"],
    authenticatedAt: 1_000,
    expiresAt: 2_000,
  }, secret);
  assert.equal(parseSession(token, secret, 1_500)?.principalId, "principal-1");
  assert.equal(parseSession(`${token}x`, secret, 1_500), null);
  assert.equal(parseSession(token, secret, 2_001), null);
});

test("CSRF token is session-bound and uses constant data", () => {
  const token = createCsrfToken("session-id", secret);
  assert.equal(verifyCsrfToken(token, "session-id", secret), true);
  assert.equal(verifyCsrfToken(token, "other-session", secret), false);
});

test("role matrix keeps approval and dispatch separate", () => {
  assert.equal(can(["operator"], "prepare"), true);
  assert.equal(can(["operator"], "approve"), false);
  assert.equal(can(["approver"], "dispatch"), false);
  assert.equal(can(["dispatcher"], "approve"), false);
  assert.throws(() => requireCapability(["auditor"], "prepare"), /denied/);
});
