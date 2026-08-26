import { createHmac, timingSafeEqual } from "node:crypto";

export type FoxitLifecycle = "created" | "sent" | "viewed" | "completed" | "declined" | "cancelled";
export type FoxitWebhookEvent = { eventId: string; envelopeId: string; type: FoxitLifecycle; occurredAt: string };

export function verifyFoxitWebhook(input: { rawBody: Uint8Array; signature: string; secrets: readonly string[]; maxBytes?: number }): FoxitWebhookEvent {
  if (!input.rawBody.length || input.rawBody.length > (input.maxBytes ?? 1_048_576)) throw new Error("Webhook body size is invalid");
  const supplied = parseSignature(input.signature);
  const valid = input.secrets.some((secret) => { const expected=createHmac("sha256",secret).update(input.rawBody).digest(); return expected.length===supplied.length&&timingSafeEqual(expected,supplied); });
  if (!valid) throw new Error("Webhook signature is invalid");
  let value: unknown; try { value=JSON.parse(Buffer.from(input.rawBody).toString("utf8")); } catch { throw new Error("Webhook JSON is malformed"); }
  if (!value||typeof value!=="object") throw new Error("Webhook event is invalid"); const record=value as Record<string,unknown>;
  const eventId=record.eventId, envelopeId=record.envelopeId, type=record.type, occurredAt=record.occurredAt;
  const types=new Set(["created","sent","viewed","completed","declined","cancelled"]);
  if(typeof eventId!=="string"||typeof envelopeId!=="string"||typeof type!=="string"||!types.has(type)||typeof occurredAt!=="string"||!Number.isFinite(Date.parse(occurredAt))) throw new Error("Webhook event is invalid");
  return {eventId,envelopeId,type:type as FoxitLifecycle,occurredAt};
}
function parseSignature(value:string){const normalized=value.startsWith("sha256=")?value.slice(7):value; if(!/^[a-f0-9]{64}$/.test(normalized)) throw new Error("Webhook signature is malformed"); return Buffer.from(normalized,"hex");}
