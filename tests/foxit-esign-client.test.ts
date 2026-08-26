import assert from "node:assert/strict";
import test from "node:test";
import { FoxitESignClient } from "../src/server/foxit/esign-client";
import { redactESignError, type ESignEnvelopeRequest } from "../src/server/foxit/esign-adapter";

const request: ESignEnvelopeRequest = { idempotencyKey: "signlatch:approval", approvalDigest: "a".repeat(64), documentSha256: "b".repeat(64), documentBase64: "JVBERi0=", recipients: [{ name: "Signer", email: "signer@example.invalid", order: 1 }], fields: [], subject: "Sign", message: "Please sign" };
const config = { baseUrl: "https://esign.example.invalid", tokenPath: "/oauth/token", envelopePath: "/api/envelopes", clientId: "id", clientSecret: "secret" };

test("OAuth remains server-only and envelope request carries a stable key", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(input), init }); return calls.length === 1 ? Response.json({ access_token: "private-token" }) : Response.json({ envelopeId: "env-1" }, { status: 201, headers: { "x-correlation-id": "corr-1" } }); };
  const result = await new FoxitESignClient(config, fetcher as typeof fetch).createEnvelope(request);
  assert.deepEqual(result, { status: "sent", providerEnvelopeId: "env-1", correlationId: "corr-1" });
  assert.equal((calls[1].init?.headers as Record<string, string>)["idempotency-key"], request.idempotencyKey);
  assert.ok(!JSON.stringify(calls[1].init?.body).includes("private-token"));
});

test("server errors are ambiguous and credentials are redacted", async () => {
  const fetcher = async () => Response.json({ access_token: "token" });
  const client = new FoxitESignClient(config, (async (...args: Parameters<typeof fetch>) => args[0].toString().includes("oauth") ? fetcher() : new Response(null, { status: 503 })) as typeof fetch);
  assert.deepEqual(await client.createEnvelope(request), { status: "ambiguous", correlationId: undefined });
  assert.deepEqual(redactESignError({ status: 401, code: "invalid", clientSecret: "never" }), { status: 401, code: "invalid", correlationId: undefined });
  assert.throws(() => new FoxitESignClient({ ...config, baseUrl: "http://unsafe.invalid" }), /HTTPS/);
});
