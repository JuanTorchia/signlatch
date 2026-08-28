import assert from "node:assert/strict";
import test from "node:test";

import { parseActivityEvents } from "../src/server/provider/activity-reconciler";

test("maps authenticated Foxit activity into deterministic sanitized lifecycle events", () => {
  const now = Date.parse("2026-08-28T08:00:00Z");
  const payload = { details: { activities: [
    { action: "Invitation Sent", folderStatus: "SHARED", time: "28 Aug 2026, 00:03:48, PDT", activity: "private recipient text" },
    { action: "Signed", folderStatus: "COMPLETED", time: "28 Aug 2026, 00:15:33, PDT" },
    { action: "Folder Executed", folderStatus: "EXECUTED", time: "28 Aug 2026, 00:15:33, PDT" },
    { action: "Signed Folder Link Emailed", folderStatus: "EXECUTED", time: "28 Aug 2026, 00:16:36, PDT" },
  ] } };
  const first = parseActivityEvents(payload, "35613299", now);
  const second = parseActivityEvents(payload, "35613299", now);
  assert.deepEqual(first, second);
  assert.equal(first[0].type, "sent");
  assert.deepEqual(new Set(first.slice(1).map((event) => event.type)), new Set(["signed", "executed"]));
  assert.ok(first.every((event) => /^[a-f0-9]{64}$/.test(event.eventId)));
  assert.ok(!JSON.stringify(first).includes("private recipient text"));
});

test("rejects stale, future, oversized, and malformed activity histories", () => {
  const now = Date.parse("2026-08-28T08:00:00Z");
  assert.throws(() => parseActivityEvents({}, "35613299", now), /invalid/);
  assert.throws(() => parseActivityEvents({ details: { activities: [] } }, "35613299", now), /no supported/);
  assert.throws(() => parseActivityEvents({ details: { activities: [
    { action: "Signed", folderStatus: "COMPLETED", time: "1 Jan 2020, 00:00:00, PDT" },
  ] } }, "35613299", now), /timestamp/);
  assert.throws(() => parseActivityEvents({ details: { activities: [
    { action: "Signed", folderStatus: "COMPLETED", time: "31 Feb 2026, 00:00:00, UTC" },
  ] } }, "35613299", now), /timestamp/);
});
