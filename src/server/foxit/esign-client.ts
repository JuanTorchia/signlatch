import type { ESignEnvelopeRequest, ESignResult, FoxitESignAdapter } from "./esign-adapter";

type Config = { baseUrl: string; tokenPath: string; envelopePath: string; clientId: string; clientSecret: string; timeoutMs?: number; detailsPath?: string; activityPath?: string; executedDocumentPath?: string; correlationPath?: string };

export class FoxitESignClient implements FoxitESignAdapter {
  constructor(private readonly config: Config, private readonly fetcher: typeof fetch = fetch) { assertConfig(config); }
  async createEnvelope(input: ESignEnvelopeRequest): Promise<ESignResult> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 15_000);
    try {
      const token = await this.token(controller.signal);
      const response = await this.fetcher(new URL(this.config.envelopePath, this.config.baseUrl), { method: "POST", signal: controller.signal,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": input.idempotencyKey }, body: JSON.stringify(input) });
      const correlationId = response.headers.get("x-correlation-id") ?? undefined;
      if (response.status === 429) return { status: "safe-retry", errorCode: "rate-limited" };
      if (response.status >= 500) return { status: "ambiguous", correlationId };
      if (!response.ok) return { status: "denied", errorCode: `foxit-http-${response.status}` };
      const body = await response.json() as Record<string, unknown>;
      const id = body.envelopeId ?? body.folderId ?? body.id;
      return typeof id === "string" && id ? { status: "sent", providerEnvelopeId: id, correlationId } : { status: "ambiguous", correlationId };
    } catch { return { status: "ambiguous" }; } finally { clearTimeout(timer); }
  }
  async findByCorrelation(idempotencyKey: string): Promise<{providerEnvelopeId:string}|null> { if(!this.config.correlationPath)return null;const body=await this.getJson(this.pathFor(this.config.correlationPath,idempotencyKey,"idempotencyKey"));const id=body.envelopeId??body.folderId??body.id;return typeof id==="string"&&id?{providerEnvelopeId:id}:null; }
  async getEnvelopeDetails(envelopeId: string): Promise<Record<string, unknown>> { return this.getJson(this.pathFor(this.config.detailsPath, envelopeId)); }
  async getActivityHistory(envelopeId: string): Promise<Record<string, unknown>> { return this.getJson(this.pathFor(this.config.activityPath, envelopeId)); }
  async downloadExecutedDocument(envelopeId: string): Promise<Uint8Array> {
    const path = this.pathFor(this.config.executedDocumentPath, envelopeId); const token=await this.token(AbortSignal.timeout(this.config.timeoutMs??15_000));
    const response=await this.fetcher(new URL(path,this.config.baseUrl),{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(this.config.timeoutMs??15_000)}); if(!response.ok)throw new Error("Executed document retrieval failed"); const bytes=new Uint8Array(await response.arrayBuffer()); if(!bytes.length||bytes.length>10*1024*1024)throw new Error("Executed document size is invalid"); return bytes;
  }
  private pathFor(template:string|undefined,value:string,placeholder="envelopeId"){if(!template||!template.startsWith("/")||!template.includes(`{${placeholder}}`))throw new Error("Foxit eSign retrieval path is not configured");return template.replace(`{${placeholder}}`,encodeURIComponent(value));}
  private async getJson(path:string){const token=await this.token(AbortSignal.timeout(this.config.timeoutMs??15_000));const response=await this.fetcher(new URL(path,this.config.baseUrl),{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(this.config.timeoutMs??15_000)});if(!response.ok)throw new Error("Foxit eSign retrieval failed");return await response.json() as Record<string,unknown>;}
  private async token(signal: AbortSignal): Promise<string> {
    const response = await this.fetcher(new URL(this.config.tokenPath, this.config.baseUrl), { method: "POST", signal,
      headers: { authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
    if (!response.ok) throw new Error("Foxit OAuth denied");
    const body = await response.json() as Record<string, unknown>;
    if (typeof body.access_token !== "string" || !body.access_token) throw new Error("Foxit OAuth response is invalid");
    return body.access_token;
  }
}

export function foxitESignConfigFromEnv(): Config {
  return {baseUrl:required("FOXIT_ESIGN_BASE_URL"),tokenPath:required("FOXIT_ESIGN_TOKEN_PATH"),envelopePath:required("FOXIT_ESIGN_ENVELOPE_PATH"),clientId:required("FOXIT_ESIGN_CLIENT_ID"),clientSecret:required("FOXIT_ESIGN_CLIENT_SECRET"),detailsPath:process.env.FOXIT_ESIGN_DETAILS_PATH,activityPath:process.env.FOXIT_ESIGN_ACTIVITY_PATH,executedDocumentPath:process.env.FOXIT_ESIGN_EXECUTED_DOCUMENT_PATH,correlationPath:process.env.FOXIT_ESIGN_CORRELATION_PATH};
}
function required(name:string){const value=process.env[name]?.trim();if(!value)throw new Error(`${name} is required`);return value;}

function assertConfig(config: Config) {
  const base = new URL(config.baseUrl);
  if (base.protocol !== "https:" || base.username || base.password) throw new Error("Foxit eSign base URL must be credential-free HTTPS");
  if (!config.tokenPath.startsWith("/") || !config.envelopePath.startsWith("/")) throw new Error("Foxit paths must be absolute paths");
  if (!config.clientId || !config.clientSecret) throw new Error("Foxit eSign credentials are required");
}
