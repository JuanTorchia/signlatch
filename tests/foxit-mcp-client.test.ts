import assert from "node:assert/strict";
import { test } from "node:test";

import { foxitMcpConfigFromEnv } from "../src/server/foxit/mcp-client";

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
  });
  assert.equal(config.command, "/usr/local/bin/uv");
});

test("fails closed when Foxit credentials are missing", () => {
  assert.throws(() => foxitMcpConfigFromEnv({}), /FOXIT_CLOUD_API_HOST/);
});
