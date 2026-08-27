import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { spawn } from "node:child_process";
import path from "node:path";
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
  moduleRoot?: string;
};

const MCP_CONNECT_TIMEOUT_MS = 15_000;
const MCP_TOOL_TIMEOUT_MS = 310_000;
const MAX_MCP_TEXT_BYTES = 64 * 1024;
const FOXIT_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function foxitMcpConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): FoxitMcpConfig {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing required Foxit configuration: ${name}`);
    return value;
  };

  return {
    command: validatedCommand(env),
    args: ["run", "--frozen", "--no-sync", "python", "-m", "foxit_pdf_api_mcp_server.main"],
    cwd: validatedWorkingDirectory(env),
    moduleRoot: env.FOXIT_MCP_MODULE_ROOT?.trim() || undefined,
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
      { timeout: MCP_TOOL_TIMEOUT_MS, maxTotalTimeout: MCP_TOOL_TIMEOUT_MS },
    )) as CallToolResult;
    if (result.isError) throw new Error(`Foxit MCP tool failed: ${call.name}`);
    const text = result.content.find((item) => item.type === "text");
    if (!text || text.type !== "text") throw new Error("Foxit MCP returned no text result");
    if (Buffer.byteLength(text.text, "utf8") > MAX_MCP_TEXT_BYTES) {
      throw new Error("Foxit MCP text result exceeds the response limit");
    }
    return parseToolResult(call.name, JSON.parse(text.text));
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
    transport.stderr?.on("data", () => undefined);
    const client = new Client({ name: "signlatch", version: "0.1.0" });
    try {
      await withTimeout(client.connect(transport), MCP_CONNECT_TIMEOUT_MS, "Foxit MCP connect timeout");
    } catch (error) {
      await transport.close().catch(() => undefined);
      throw error;
    }
    this.client = client;
    return client;
  }
}

function validatedCommand(env: Record<string, string | undefined>): string {
  const command = env.FOXIT_MCP_COMMAND?.trim() || "uv";
  if (env.NODE_ENV === "production" && !command.startsWith("/")) {
    throw new Error("FOXIT_MCP_COMMAND must be an absolute path in production");
  }
  return command;
}

function validatedWorkingDirectory(env: Record<string, string | undefined>): string | undefined {
  const cwd = env.FOXIT_MCP_CWD?.trim();
  const moduleRoot = env.FOXIT_MCP_MODULE_ROOT?.trim();
  if (env.NODE_ENV !== "production") return cwd || undefined;
  if (!cwd || !path.isAbsolute(cwd)) throw new Error("FOXIT_MCP_CWD must be absolute in production");
  if (!moduleRoot || !path.isAbsolute(moduleRoot)) {
    throw new Error("FOXIT_MCP_MODULE_ROOT must be absolute in production");
  }
  const relative = path.relative(moduleRoot, cwd);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("FOXIT_MCP_CWD must be inside the approved module root");
  }
  return cwd;
}

export type BoundedChildOptions = {
  cwd: string;
  env: Record<string, string>;
  timeoutMs: number;
  killGraceMs: number;
  maxOutputBytes: number;
};

export function runBoundedChild(
  command: string,
  args: string[],
  options: BoundedChildOptions,
): Promise<{ stdout: Buffer; stderr: Buffer }> {
  return new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      detached,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end();
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;

    const terminate = () => {
      if (child.pid && detached) {
        try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
      } else child.kill("SIGTERM");
      setTimeout(() => {
        if (child.pid && detached) {
          try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ }
        } else child.kill("SIGKILL");
      }, options.killGraceMs).unref();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      terminate();
      reject(error);
    };
    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > options.maxOutputBytes) return fail(new Error("Child output limit exceeded"));
      target.push(chunk);
    };

    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.once("error", fail);
    const timer = setTimeout(() => fail(new Error("Child process timed out")), options.timeoutMs);
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code !== 0) return reject(new Error(`Child exited with ${code ?? signal ?? "unknown"}`));
      resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseToolResult(name: ToolCall["name"], value: unknown): ToolResult {
  if (typeof value !== "object" || value === null || !("success" in value) || value.success !== true) {
    throw new Error(`Foxit MCP returned an unsuccessful result for ${name}`);
  }
  const record = value as Record<string, unknown>;
  const id = (field: string) => {
    const candidate = record[field];
    if (typeof candidate !== "string" || !FOXIT_ID.test(candidate)) {
      throw new Error(`Foxit MCP returned an invalid ${field} for ${name}`);
    }
    return candidate;
  };
  if (name === "upload_document") return { success: true, documentId: id("documentId") };
  if (name === "pdf_from_text") {
    return { success: true, taskId: id("taskId"), resultDocumentId: id("resultDocumentId") };
  }
  const size = record.size;
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 1 || size > 20 * 1024 * 1024) {
    throw new Error("Foxit MCP returned an invalid download size");
  }
  return { success: true, documentId: id("documentId"), size };
}
