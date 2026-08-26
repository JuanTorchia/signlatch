import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) return new Response("Authentication is not configured", { status: 503 });
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("signlatch_oauth_state", state, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/api/auth/callback",
    maxAge: 600,
  });
  const callback = new URL("/api/auth/callback", request.url);
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", callback.toString());
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("scope", "read:user");
  return Response.redirect(authorize);
}
