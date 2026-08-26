import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import { verifyFoxitWebhook } from "../src/server/provider/foxit-webhook";

const secret = "old-webhook-secret-at-least-32-bytes";
const payload = {
  event_name: "folder_executed",
  event_date: Date.parse("2026-08-26T12:00:00Z"),
  data: { folder: { folderId: 731, folderStatus: "EXECUTED" } },
};
const raw = Buffer.from(JSON.stringify(payload));
const signature = createHmac("sha256", secret).update(raw).digest("base64");

test("official base64 raw-body HMAC accepts active and rotation secrets", () => {
  assert.deepEqual(
    verifyFoxitWebhook({
      rawBody: raw,
      signature,
      secrets: ["new-webhook-secret-at-least-32-bytes", secret],
    }),
    {
      eventId: createHash("sha256").update(raw).digest("hex"),
      envelopeId: "731",
      type: "executed",
      occurredAt: "2026-08-26T12:00:00.000Z",
    },
  );
});

test("every supported Foxit event maps to the internal lifecycle", () => {
  const cases = [
    ["folder_sent", "sent"],
    ["folder_viewed", "viewed"],
    ["folder_signed", "signed"],
    ["folder_completed", "completed"],
    ["folder_executed", "executed"],
    ["folder_cancelled", "cancelled"],
  ] as const;
  for (const [event_name, expected] of cases) {
    const body = Buffer.from(JSON.stringify({ ...payload, event_name }));
    const signed = createHmac("sha256", secret).update(body).digest("base64");
    assert.equal(
      verifyFoxitWebhook({ rawBody: body, signature: signed, secrets: [secret] })
        .type,
      expected,
    );
  }
});

test("forged, malformed, unknown, empty, and oversized webhooks fail closed", () => {
  assert.throws(
    () =>
      verifyFoxitWebhook({
        rawBody: raw,
        signature: Buffer.alloc(32).toString("base64"),
        secrets: [secret],
      }),
    /signature/,
  );
  assert.throws(
    () =>
      verifyFoxitWebhook({
        rawBody: raw,
        signature: createHmac("sha256", secret).update(raw).digest("hex"),
        secrets: [secret],
      }),
    /malformed/,
  );
  const unknown = Buffer.from(JSON.stringify({ ...payload, event_name: "folder_deleted" }));
  assert.throws(
    () =>
      verifyFoxitWebhook({
        rawBody: unknown,
        signature: createHmac("sha256", secret).update(unknown).digest("base64"),
        secrets: [secret],
      }),
    /invalid/,
  );
  assert.throws(
    () =>
      verifyFoxitWebhook({
        rawBody: Buffer.from("{"),
        signature: createHmac("sha256", secret).update("{").digest("base64"),
        secrets: [secret],
      }),
    /JSON/,
  );
  assert.throws(
    () =>
      verifyFoxitWebhook({
        rawBody: new Uint8Array(),
        signature,
        secrets: [secret],
      }),
    /size/,
  );
  assert.throws(
    () =>
      verifyFoxitWebhook({
        rawBody: Buffer.alloc(11),
        signature,
        secrets: [secret],
        maxBytes: 10,
      }),
    /size/,
  );
});
