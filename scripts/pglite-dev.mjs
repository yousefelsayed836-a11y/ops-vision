import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const records = [];
try {
  const databases = process.argv.includes("--test-only")
    ? [["test", 51224]]
    : process.argv.includes("--development-only")
      ? [["development", 51214]]
      : [["development", 51214], ["test", 51224]];
  for (const [name, port] of databases) {
    const override = name === "development" ? process.env.OPSVISION_DB_DIR : process.env.OPSVISION_TEST_DB_DIR;
    const location = override ? resolve(override) : resolve(".data", `pglite-${name}`);
    mkdirSync(location, { recursive: true });
    const db = await PGlite.create(location);
    const server = new PGLiteSocketServer({
      db,
      host: "127.0.0.1",
      port,
      maxConnections: 20,
    });
    await server.start();
    records.push({ db, server });
    console.log(`Isolated ${name} database ready on loopback port ${port}.`);
  }
} catch (error) {
  console.error("Local database startup failed:", error.message);
  process.exitCode = 1;
}
async function stop() {
  for (const { db, server } of records) {
    await server.stop();
    await db.close();
  }
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
