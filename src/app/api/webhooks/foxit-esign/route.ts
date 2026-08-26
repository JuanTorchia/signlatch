import { readBoundedBody, BodyLimitError } from "@/server/http/bounded-body";
import { verifyFoxitWebhook } from "@/server/provider/foxit-webhook";
import { ProviderEventStore } from "@/server/provider/event-store";
import { database } from "@/server/database";

export async function POST(request: Request) {
  const limit = Number(process.env.SIGNLATCH_WEBHOOK_BODY_LIMIT_BYTES ?? 1_048_576);
  try {
    const rawBody = await readBoundedBody(request, limit);
    const secrets = [process.env.FOXIT_ESIGN_WEBHOOK_SECRET, process.env.FOXIT_ESIGN_WEBHOOK_PREVIOUS_SECRET].filter((v): v is string => Boolean(v));
    if (!secrets.length) return new Response("Unavailable", { status: 503 });
    const event = verifyFoxitWebhook({ rawBody, signature: request.headers.get("x-foxit-signature") ?? "", secrets, maxBytes: limit });
    const result = await new ProviderEventStore(database()).record(event);
    return Response.json({ accepted: true, duplicate: result.duplicate });
  } catch (error) {
    if (error instanceof BodyLimitError) return new Response("Payload too large", { status: 413 });
    return new Response("Unauthorized", { status: 401 });
  }
}
