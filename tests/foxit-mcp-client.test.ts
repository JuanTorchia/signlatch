import assert from "node:assert/strict";
import { test } from "node:test";

import { foxitMcpConfigFromEnv, runBoundedChild } from "../src/server/foxit/mcp-client";

const credentials = {
  FOXIT_CLOUD_API_HOST: "https://example.test/pdf-services",
  FOXIT_CLOUD_API_CLIENT_ID: "client-test",
  FOXIT_CLOUD_API_CLIENT_SECRET: "secret-test",
};

test("pins the Foxit Python module arguments", () => {
  const config = foxitMcpConfigFromEnv({
    ...credentials,
    FOXIT_MCP_ARGS: "run attacker-command",
  });
  assert.deepEqual(config.args, ["run", "python", "-m", "foxit_pdf_api_mcp_server.main"]);
});

test("requires an absolute MCP executable in production", () => {
  assert.throws(
    () => foxitMcpConfigFromEnv({ ...credentials, NODE_ENV: "production", FOXIT_MCP_COMMAND: "uv" }),
    /absolute path/,
  );
  const config = foxitMcpConfigFromEnv({
    ...credentials,
    NODE_ENV: "production",
    FOXIT_MCP_COMMAND: "/usr/local/bin/uv",
    FOXIT_MCP_CWD: "/opt/foxit-mcp/server",
    FOXIT_MCP_MODULE_ROOT: "/opt/foxit-mcp",
  });
  assert.equal(config.command, "/usr/local/bin/uv");
});

test("fails closed when Foxit credentials are missing", () => {
  assert.throws(() => foxitMcpConfigFromEnv({}), /FOXIT_CLOUD_API_HOST/);
});

test("pins the production working directory and module root", () => {
  assert.throws(() => foxitMcpConfigFromEnv({
    ...credentials,
    NODE_ENV: "production",
    FOXIT_MCP_COMMAND: "/usr/local/bin/uv",
    FOXIT_MCP_CWD: "/opt/untrusted",
    FOXIT_MCP_MODULE_ROOT: "/opt/foxit-mcp",
  }), /module root/);
});

test("bounded child terminates a timed-out process tree", async () => {
  const started = Date.now();
  await assert.rejects(
    runBoundedChild(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      cwd: process.cwd(),
      env: {},
      timeoutMs: 50,
      killGraceMs: 50,
      maxOutputBytes: 1024,
    }),
    /timed out/,
  );
  assert.ok(Date.now() - started < 1_000);
});

test("bounded child rejects excessive combined output", async () => {
  await assert.rejects(
    runBoundedChild(process.execPath, ["-e", "process.stdout.write('x'.repeat(2048))"], {
      cwd: process.cwd(),
      env: {},
      timeoutMs: 1_000,
      killGraceMs: 50,
      maxOutputBytes: 1024,
    }),
    /output limit/,
  );
});
