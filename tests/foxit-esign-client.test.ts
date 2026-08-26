import assert from "node:assert/strict";
import test from "node:test";
import { FoxitESignClient } from "../src/server/foxit/esign-client";
import {
  redactESignError,
  type ESignEnvelopeRequest,
} from "../src/server/foxit/esign-adapter";

const request: ESignEnvelopeRequest = {
  idempotencyKey: "signlatch:approval",
  approvalDigest: "a".repeat(64),
  documentSha256: "b".repeat(64),
  documentBase64: "JVBERi0=",
  recipients: [
    { name: "Jane Doe", email: "signer@example.invalid", order: 1 },
  ],
  fields: [
    { recipientEmail: "signer@example.invalid", page: 1, x: 108, y: 565 },
  ],
  subject: "Sign",
  message: "Please sign",
};

const config = {
  baseUrl: "https://na1.fusion.foxit.com",
  envelopePath: "/esign/api/v1/folders/createfolder",
  clientId: "id",
  clientSecret: "secret",
};

test("Fusion credentials remain server-only and createfolder receives the exact approved PDF", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ url: String(input), init });
    return Response.json(
      { folder: { folderId: 731 } },
      { status: 200, headers: { "x-correlation-id": "corr-1" } },
    );
  };

  const result = await new FoxitESignClient(
    config,
    fetcher as typeof fetch,
  ).createEnvelope(request);

  assert.deepEqual(result, {
    status: "sent",
    providerEnvelopeId: "731",
    correlationId: "corr-1",
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://na1.fusion.foxit.com/esign/api/v1/folders/createfolder",
  );
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.client_id, "id");
  assert.equal(headers.client_secret, "secret");
  assert.equal(headers["idempotency-key"], request.idempotencyKey);
  assert.equal(headers.authorization, undefined);

  const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
  assert.equal(body.inputType, "base64");
  assert.deepEqual(body.base64FileString, [request.documentBase64]);
  assert.equal(body.sendNow, true);
  assert.equal(body.custom_field1, request.idempotencyKey);
  assert.deepEqual(body.parties, [
    {
      firstName: "Jane",
      lastName: "Doe",
      emailId: "signer@example.invalid",
      permission: "FILL_FIELDS_AND_SIGN",
      sequence: 1,
    },
  ]);
  assert.deepEqual(body.fields, [
    {
      type: "signature",
      x: 108,
      y: 565,
      width: 120,
      height: 40,
      documentNumber: 1,
      pageNumber: 1,
      tabOrder: 1,
      party: 1,
      required: true,
    },
  ]);
  assert.ok(!String(calls[0].init?.body).includes("secret"));
});

test("server errors are ambiguous and credentials are redacted", async () => {
  const client = new FoxitESignClient(
    config,
    (async () => new Response(null, { status: 503 })) as typeof fetch,
  );
  assert.deepEqual(await client.createEnvelope(request), {
    status: "ambiguous",
    correlationId: undefined,
  });
  assert.deepEqual(
    redactESignError({ status: 401, code: "invalid", clientSecret: "never" }),
    { status: 401, code: "invalid", correlationId: undefined },
  );
  assert.throws(
    () => new FoxitESignClient({ ...config, baseUrl: "http://unsafe.invalid" }),
    /HTTPS/,
  );
});

test("a field cannot target a recipient outside the approved recipient list", async () => {
  const invalid = {
    ...request,
    fields: [
      { recipientEmail: "other@example.invalid", page: 1, x: 1, y: 1 },
    ],
  };
  const client = new FoxitESignClient(
    config,
    (async () => {
      throw new Error("must not call provider");
    }) as typeof fetch,
  );
  assert.deepEqual(await client.createEnvelope(invalid), { status: "ambiguous" });
});
