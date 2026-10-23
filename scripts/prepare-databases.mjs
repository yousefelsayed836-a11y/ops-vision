import "dotenv/config";
import pg from "pg";
const url = new URL(process.env.DATABASE_URL);
url.pathname = "/postgres";
const client = new pg.Client({
  connectionString: url.toString(),
  connectionTimeoutMillis: 5000,
});
try {
  await client.connect();
  for (const name of ["opsvision", "opsvision_test"]) {
    const existing = await client.query(
      "SELECT 1 FROM pg_database WHERE datname=$1",
      [name],
    );
    if (!existing.rowCount) await client.query(`CREATE DATABASE "${name}"`);
  }
  console.log("Development and dedicated test databases are available.");
} catch (error) {
  console.error("Database preparation failed:", error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await client.end();
}
