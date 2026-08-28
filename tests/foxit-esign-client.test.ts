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
  assert.equal(calls[0].init?.redirect, "manual");

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
    diagnostic: { phase: "response", code: "http-503", httpStatus: 503, contentType: undefined, responseBytes: 0, responseSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
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
  assert.deepEqual(await client.createEnvelope(invalid), {
    status: "denied",
    errorCode: "local-request-invalid",
    diagnostic: { phase: "local-validation", code: "payload-invalid" },
  });
});

test("successful responses without a documented folder id retain only safe diagnostics", async () => {
  const client = new FoxitESignClient(config, (async () => new Response(
    JSON.stringify({ result: "success", unexpected: { recipient: "must-not-be-logged" } }),
    { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
  )) as typeof fetch);
  const result = await client.createEnvelope(request);
  assert.equal(result.status, "ambiguous");
  if (result.status !== "ambiguous") return;
  assert.equal(result.diagnostic.code, "missing-folder-id");
  assert.deepEqual(result.diagnostic.responseKeys, ["result"]);
  assert.equal(result.diagnostic.contentType, "application/json");
  assert.equal(result.diagnostic.responseSha256?.length, 64);
  assert.equal(JSON.stringify(result).includes("must-not-be-logged"), false);
});

test("malformed and oversized success bodies fail closed with bounded diagnostics", async () => {
  const malformed = new FoxitESignClient(config, (async () => new Response("not-json", { status: 200 })) as typeof fetch);
  const malformedResult = await malformed.createEnvelope(request);
  assert.equal(malformedResult.status, "ambiguous");
  if (malformedResult.status === "ambiguous") assert.equal(malformedResult.diagnostic.code, "invalid-json");

  const oversized = new FoxitESignClient(config, (async () => new Response("x".repeat(70 * 1024), { status: 200 })) as typeof fetch);
  const oversizedResult = await oversized.createEnvelope(request);
  assert.equal(oversizedResult.status, "ambiguous");
  if (oversizedResult.status === "ambiguous") assert.equal(oversizedResult.diagnostic.code, "response-too-large");
});

test("configured retrieval paths cannot change the Foxit origin", () => {
  assert.throws(() => new FoxitESignClient({ ...config, detailsPath: "//attacker.invalid/{envelopeId}" }), /provider origin/);
  assert.throws(() => new FoxitESignClient({ ...config, activityPath: "/safe\\evil/{envelopeId}" }), /provider origin/);
});

test("credentialed requests never follow provider redirects", async () => {
  let redirectMode: RequestRedirect | undefined;
  const client = new FoxitESignClient(config, (async (_input, init) => {
    redirectMode = init?.redirect;
    return new Response(null, { status: 302, headers: { location: "https://attacker.invalid" } });
  }) as typeof fetch);
  const result = await client.createEnvelope(request);
  assert.equal(redirectMode, "manual");
  assert.equal(result.status, "ambiguous");
  if (result.status === "ambiguous") assert.equal(result.diagnostic.code, "redirect-rejected");
});

test("rate limits accept delta-seconds and HTTP-date Retry-After values", async () => {
  const delta = new FoxitESignClient(config, (async () => new Response(null, { status: 429, headers: { "retry-after": "3600" } })) as typeof fetch);
  const deltaResult = await delta.createEnvelope(request);
  assert.equal(deltaResult.status, "safe-retry");
  if (deltaResult.status === "safe-retry") assert.equal(deltaResult.retryAfterMs, 3_600_000);

  const future = new Date(Date.now() + 60 * 60_000).toUTCString();
  const dated = new FoxitESignClient(config, (async () => new Response(null, { status: 429, headers: { "retry-after": future } })) as typeof fetch);
  const datedResult = await dated.createEnvelope(request);
  assert.equal(datedResult.status, "safe-retry");
  if (datedResult.status === "safe-retry") assert.ok((datedResult.retryAfterMs ?? 0) > 59 * 60_000);
});

test("correlation lookup requires an exact echoed idempotency key and a bounded scalar folder id", async () => {
  const correlationConfig = { ...config, correlationPath: "/lookup?key={idempotencyKey}" };
  const matching = new FoxitESignClient(correlationConfig, (async () => Response.json({ folder: { folderId: "folder-42", custom_field1: request.idempotencyKey } })) as typeof fetch);
  assert.deepEqual(await matching.findByCorrelation(request.idempotencyKey), { providerEnvelopeId: "folder-42" });

  const wrong = new FoxitESignClient(correlationConfig, (async () => Response.json({ folder: { folderId: "folder-42", custom_field1: "another-key" } })) as typeof fetch);
  assert.equal(await wrong.findByCorrelation(request.idempotencyKey), null);

  const malformed = new FoxitESignClient(correlationConfig, (async () => Response.json({ folder: { folderId: { nested: true }, custom_field1: request.idempotencyKey } })) as typeof fetch);
  assert.equal(await malformed.findByCorrelation(request.idempotencyKey), null);
});
