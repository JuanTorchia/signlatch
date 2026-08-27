export function publicOrigin(env: Readonly<Record<string, string | undefined>>): URL {
  const configured = env.SIGNLATCH_PUBLIC_ORIGIN?.trim();
  if (!configured) throw new Error("Missing authentication configuration: SIGNLATCH_PUBLIC_ORIGIN");

  const origin = new URL(configured);
  if (origin.protocol !== "https:" || origin.username || origin.password
    || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("SIGNLATCH_PUBLIC_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment");
  }
  return origin;
}
