import { parseSession, verifyCsrfToken, type SessionClaims } from "./session";

export class AuthenticationError extends Error {
  readonly status = 401;
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationError";
  }
}

export function sessionFromRequest(request: Request): SessionClaims {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) throw new AuthenticationError();
  const cookies = parseCookieHeader(request.headers.get("cookie") ?? "");
  const session = parseSession(cookies.signlatch_session ?? "", secret);
  if (!session) throw new AuthenticationError();
  return session;
}

export function requireRequestCsrf(request: Request, sessionToken?: string): void {
  const secret = process.env.AUTH_SESSION_SECRET;
  const cookies = parseCookieHeader(request.headers.get("cookie") ?? "");
  const token = request.headers.get("x-signlatch-csrf");
  if (!secret || !token || !sessionToken || cookies.signlatch_session !== sessionToken) {
    throw new AuthenticationError();
  }
  if (!verifyCsrfToken(token, sessionToken, secret)) throw new AuthenticationError();
}

export function sessionTokenFromRequest(request: Request): string | undefined {
  return parseCookieHeader(request.headers.get("cookie") ?? "").signlatch_session;
}

function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of header.split(";")) {
    const index = item.indexOf("=");
    if (index < 1) continue;
    result[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim());
  }
  return result;
}
