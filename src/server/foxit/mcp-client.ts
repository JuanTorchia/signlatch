import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResultSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

import {
  assertPreparationTool,
  type PdfToolCaller,
  type ToolCall,
  type ToolResult,
} from "@/core/pdf/preparation";

type FoxitMcpConfig = {
  command: string;
  args: string[];
  cwd?: string;
  apiHost: string;
  clientId: string;
  clientSecret: string;
};

export function foxitMcpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): FoxitMcpConfig {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing required Foxit configuration: ${name}`);
    return value;
  };

  return {
    command: env.FOXIT_MCP_COMMAND?.trim() || "uv",
    args: (env.FOXIT_MCP_ARGS || "run python -m foxit_pdf_api_mcp_server.main")
      .split(" ")
      .filter(Boolean),
    cwd: env.FOXIT_MCP_CWD?.trim() || undefined,
    apiHost: required("FOXIT_CLOUD_API_HOST"),
    clientId: required("FOXIT_CLOUD_API_CLIENT_ID"),
    clientSecret: required("FOXIT_CLOUD_API_CLIENT_SECRET"),
  };
}

export class FoxitStdioMcpClient implements PdfToolCaller {
  private client?: Client;

  constructor(private readonly config: FoxitMcpConfig) {}

  async call(call: ToolCall): Promise<ToolResult> {
    assertPreparationTool(call.name);
    const client = await this.connectedClient();
    const result = (await client.callTool(
      { name: call.name, arguments: call.arguments },
      CallToolResultSchema,
    )) as CallToolResult;
    if (result.isError) throw new Error(`Foxit MCP tool failed: ${call.name}`);
    const text = result.content.find((item) => item.type === "text");
    if (!text || text.type !== "text") throw new Error("Foxit MCP returned no text result");
    const payload: unknown = JSON.parse(text.text);
    if (!isSuccessfulToolResult(payload)) {
      throw new Error(`Foxit MCP returned an unsuccessful result for ${call.name}`);
    }
    return payload;
  }

  async close(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    await client?.close().catch(() => undefined);
  }

  private async connectedClient(): Promise<Client> {
    if (this.client) return this.client;
    const transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      cwd: this.config.cwd,
      stderr: "pipe",
      env: {
        ...getDefaultEnvironment(),
        FOXIT_CLOUD_API_HOST: this.config.apiHost,
        FOXIT_CLOUD_API_CLIENT_ID: this.config.clientId,
        FOXIT_CLOUD_API_CLIENT_SECRET: this.config.clientSecret,
      },
    });
    const client = new Client({ name: "signlatch", version: "0.1.0" });
    await client.connect(transport);
    this.client = client;
    return client;
  }
}

function isSuccessfulToolResult(value: unknown): value is ToolResult {
  return typeof value === "object" && value !== null && "success" in value && value.success === true;
}
