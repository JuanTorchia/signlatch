import { ApprovalHarness } from "../src/core/approval/harness";
import { approvalFixture, documentBytes } from "../tests/fixtures/approval";

const scenarios = [
  {
    name: "exact approved artifact",
    run() {
      const harness = new ApprovalHarness();
      const envelope = approvalFixture();
      harness.approve(envelope);
      harness.dispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z"));
    },
    expected: "ALLOW",
  },
  {
    name: "recipient substitution",
    run() {
      const harness = new ApprovalHarness();
      const envelope = approvalFixture();
      harness.approve(envelope);
      envelope.recipients[0].email = "attacker@example.com";
      envelope.fields[0].recipientEmail = "attacker@example.com";
      harness.dispatch(envelope, documentBytes, new Date("2026-08-25T12:05:00.000Z"));
    },
    expected: "BLOCK",
  },
  {
    name: "artifact mutation",
    run() {
      const harness = new ApprovalHarness();
      const envelope = approvalFixture();
      harness.approve(envelope);
      harness.dispatch(envelope, new TextEncoder().encode("tampered"), new Date("2026-08-25T12:05:00.000Z"));
    },
    expected: "BLOCK",
  },
];

let failures = 0;
for (const scenario of scenarios) {
  let actual = "ALLOW";
  try {
    scenario.run();
  } catch {
    actual = "BLOCK";
  }
  const passed = actual === scenario.expected;
  if (!passed) failures += 1;
  console.log(`${passed ? "PASS" : "FAIL"} | ${scenario.name} | expected=${scenario.expected} actual=${actual}`);
}

if (failures > 0) process.exitCode = 1;
