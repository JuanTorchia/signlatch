import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL?.trim();
  if (!url) throw new Error("MIGRATION_DATABASE_URL is required; web runtime credentials are not accepted");
  const sql = postgres(url, { max: 1 });
  try {
    await sql`select pg_advisory_lock(hashtextextended('signlatch:migrations',0))`;
    await sql`
      create table if not exists signlatch_schema_migrations (
        migration_name text primary key,
        sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
        applied_at timestamptz not null default now()
      )
    `;
    const root = path.join(process.cwd(), "migrations");
    const names = (await readdir(root)).filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
    for (const name of names) {
      const source = await readFile(path.join(root, name), "utf8");
      const digest = createHash("sha256").update(source).digest("hex");
      const existing = await sql<Array<{ sha256: string }>>`select sha256 from signlatch_schema_migrations where migration_name=${name}`;
      if (existing[0]) {
        if (existing[0].sha256 !== digest) throw new Error(`Applied migration checksum changed: ${name}`);
        continue;
      }
      await sql.begin(async tx => {
        await tx.unsafe(source);
        await tx`insert into signlatch_schema_migrations(migration_name,sha256)values(${name},${digest})`;
      });
      process.stdout.write(`${JSON.stringify({ migration: name, status: "applied" })}\n`);
    }
  } finally {
    await sql`select pg_advisory_unlock(hashtextextended('signlatch:migrations',0))`.catch(() => undefined);
    await sql.end();
  }
}

void main();
