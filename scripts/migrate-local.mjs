import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";
// Pure-JS development-only runner for this host, where Prisma's native schema executable cannot run.
// Production deployment uses prisma migrate deploy; this is never a fallback for production.
if (process.env.APP_ENV !== "development")
  throw new Error("Local migration helper is development-only");
for (const connectionString of (process.argv.includes("--development-only")
  ? [process.env.DATABASE_URL]
  : [process.env.DATABASE_URL, process.env.TEST_DATABASE_URL])) {
  const target = new URL(connectionString);
  if (
    target.hostname !== "127.0.0.1" ||
    !["51214", "51224"].includes(target.port)
  )
    throw new Error("Only isolated local development servers are allowed");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('SET search_path TO public');
    await client.query(
      'CREATE TABLE IF NOT EXISTS "_opsvision_local_migrations" (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const name of readdirSync("prisma/migrations")
      .filter((n) => /^\d/.test(n))
      .sort((a, b) => Number(b.startsWith("2026")) - Number(a.startsWith("2026")) || a.localeCompare(b))) {
      const sql = readFileSync(
        `prisma/migrations/${name}/migration.sql`,
        "utf8",
      );
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query(
        'SELECT checksum FROM "_opsvision_local_migrations" WHERE name=$1',
        [name],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error("Applied migration checksum differs");
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO "_opsvision_local_migrations" (name,checksum) VALUES ($1,$2)',
          [name, checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    console.log(
      `SQL migrations verified for isolated local port ${target.port}.`,
    );
  } finally {
    await client.end();
  }
}
