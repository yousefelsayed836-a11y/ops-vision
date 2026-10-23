import "dotenv/config";
import { db } from "../src/lib/db";
// Removes only disposable administrator fixtures created by scripts/http-smoke.ts.
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (
    process.env.APP_ENV !== "development" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "51214"
  )
    throw new Error(
      "Cleanup is restricted to the dedicated local development database",
    );
  const records = await db.user.findMany({
    where: {
      email: { startsWith: "http-admin-", endsWith: "@example.test" },
      name: "HTTP TEST · Admin",
      memberships: { none: {} },
    },
    select: { id: true },
  });
  for (const record of records)
    await db.user.delete({ where: { id: record.id } });
  console.log(
    "Disposable HTTP test administrator fixtures removed:",
    records.length,
  );
}
main()
  .catch(() => {
    console.error("Restricted test-fixture cleanup failed");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
