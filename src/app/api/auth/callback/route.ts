import { createHash } from "node:crypto";
import { cookies } from "next/headers";

import { issueSession, type SessionRole } from "@/server/auth/session";
import { publicOrigin } from "@/server/auth/public-origin";

type GitHubUser = { id: number; login: string };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("signlatch_oauth_state")?.value;
  cookieStore.delete("signlatch_oauth_state");
  if (!code || !state || !expectedState || state !== expectedState) {
    return new Response("OAuth state validation failed", { status: 400 });
  }

  const clientId = required("GITHUB_OAUTH_CLIENT_ID");
  const clientSecret = required("GITHUB_OAUTH_CLIENT_SECRET");
  const sessionSecret = required("AUTH_SESSION_SECRET");
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    cache: "no-store",
  });
  const tokenPayload = await tokenResponse.json() as { access_token?: string };
  if (!tokenResponse.ok || !tokenPayload.access_token) return new Response("OAuth exchange failed", { status: 502 });
  const userResponse = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  const user = await userResponse.json() as GitHubUser;
  if (!userResponse.ok || !Number.isSafeInteger(user.id) || !user.login) {
    return new Response("GitHub identity lookup failed", { status: 502 });
  }

  const allowed = new Set((process.env.SIGNLATCH_GITHUB_OPERATORS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean));
  if (!allowed.has(user.login.toLowerCase())) return new Response("Workspace membership required", { status: 403 });
  const now = Date.now();
  const roles: SessionRole[] = ["operator", "approver", "dispatcher", "auditor"];
  const token = issueSession({
    principalId: stableUuid(`github:${user.id}`),
    tenantId: required("SIGNLATCH_MAINTAINER_TENANT_ID"),
    roles,
    authenticatedAt: now,
    expiresAt: now + 8 * 60 * 60 * 1000,
  }, sessionSecret);
  cookieStore.set("signlatch_session", token, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return Response.redirect(new URL("/", publicOrigin(process.env)));
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing authentication configuration: ${name}`);
  return value;
}

function stableUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const text = hex.join("");
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
}
