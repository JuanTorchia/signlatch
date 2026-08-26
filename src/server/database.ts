import postgres, { type Sql } from "postgres";

let client: Sql | undefined;

export function database(): Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is required for private operations");
  client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
  });
  return client;
}
