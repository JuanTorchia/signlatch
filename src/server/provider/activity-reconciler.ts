import { createHash } from "node:crypto";

import type { FoxitLifecycle, FoxitWebhookEvent } from "./foxit-webhook";
import type { ProviderEventStore } from "./event-store";

type ActivityClient = {
  getActivityHistory(envelopeId: string): Promise<Record<string, unknown>>;
};

const LIFECYCLE_BY_ACTION: Record<string, FoxitLifecycle | undefined> = {
  Created: "created",
  "Invitation Sent": "sent",
  Opened: "viewed",
  Viewed: "viewed",
  Signed: "signed",
  "Folder Executed": "executed",
};

const ALLOWED_STATUS_BY_ACTION: Record<string, ReadonlySet<string> | undefined> = {
  Created: new Set(["CREATED", "DRAFT", "SHARED"]),
  "Invitation Sent": new Set(["SHARED"]),
  Opened: new Set(["SHARED", "PARTIALLY SIGNED", "EXECUTED"]),
  Viewed: new Set(["SHARED", "PARTIALLY SIGNED", "EXECUTED"]),
  Signed: new Set(["COMPLETED", "EXECUTED"]),
  "Folder Executed": new Set(["EXECUTED"]),
};

export class FoxitActivityReconciler {
  constructor(
    private readonly client: ActivityClient,
    private readonly events: ProviderEventStore,
  ) {}

  async reconcile(envelopeId: string, nowMs = Date.now()) {
    const payload = await this.client.getActivityHistory(envelopeId);
    const parsed = parseActivityEvents(payload, envelopeId, nowMs);
    let finalState: FoxitLifecycle | undefined;
    for (const event of parsed) {
      const result = await this.events.record(event);
      finalState = result.state;
    }
    return { imported: parsed.length, finalState };
  }
}

export function parseActivityEvents(
  payload: Record<string, unknown>,
  envelopeId: string,
  nowMs = Date.now(),
): FoxitWebhookEvent[] {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(envelopeId)) throw new Error("Envelope id is invalid");
  const details = asRecord(payload.details);
  const activities = details?.activities;
  if (!Array.isArray(activities) || activities.length > 1_000) {
    throw new Error("Foxit activity history is invalid");
  }
  const events: FoxitWebhookEvent[] = [];
  for (const value of activities) {
    const activity = asRecord(value);
    const action = activity?.action;
    const time = activity?.time;
    const folderStatus = activity?.folderStatus;
    if (typeof action !== "string" || typeof time !== "string") continue;
    const type = LIFECYCLE_BY_ACTION[action];
    if (!type) continue;
    if (typeof folderStatus !== "string" || folderStatus.length > 32 || time.length > 80) {
      throw new Error("Foxit activity entry is invalid");
    }
    if (!ALLOWED_STATUS_BY_ACTION[action]?.has(folderStatus)) {
      throw new Error("Foxit activity action and status are inconsistent");
    }
    const occurredAtMs = parseFoxitActivityTime(time);
    if (!Number.isFinite(occurredAtMs)
      || occurredAtMs < nowMs - 30 * 24 * 60 * 60 * 1_000
      || occurredAtMs > nowMs + 5 * 60 * 1_000) {
      throw new Error("Foxit activity timestamp is invalid");
    }
    const canonical = `${envelopeId}\n${action}\n${folderStatus}\n${new Date(occurredAtMs).toISOString()}`;
    events.push({
      eventId: createHash("sha256").update(canonical).digest("hex"),
      envelopeId,
      type,
      occurredAt: new Date(occurredAtMs).toISOString(),
    });
  }
  if (!events.length) throw new Error("Foxit activity history has no supported events");
  return events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.eventId.localeCompare(right.eventId));
}

function parseFoxitActivityTime(value: string): number {
  const match = /^(\d{2}) ([A-Z][a-z]{2}) (\d{4}), (\d{2}):(\d{2}):(\d{2}), (UTC|GMT|PDT|PST)$/.exec(value);
  if (!match) return Number.NaN;
  const months: Record<string, number | undefined> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const offsets: Record<string, number | undefined> = { UTC: 0, GMT: 0, PDT: -420, PST: -480 };
  const month = months[match[2]];
  const offsetMinutes = offsets[match[7]];
  if (month === undefined || offsetMinutes === undefined) return Number.NaN;
  const year = Number(match[3]);
  const day = Number(match[1]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (day < 1 || hour > 23 || minute > 59 || second > 59) return Number.NaN;
  const local = Date.UTC(year, month, day, hour, minute, second);
  const normalized = new Date(local);
  if (
    normalized.getUTCFullYear() !== year
    || normalized.getUTCMonth() !== month
    || normalized.getUTCDate() !== day
    || normalized.getUTCHours() !== hour
    || normalized.getUTCMinutes() !== minute
    || normalized.getUTCSeconds() !== second
  ) return Number.NaN;
  return local - offsetMinutes * 60_000;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
