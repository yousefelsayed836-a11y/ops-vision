import { PGlite } from "@electric-sql/pglite";
const path = process.argv[2];
const db = await PGlite.create(path);
try {
  const users = await db.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE email LIKE $1)::int AS demo FROM "User"', ["demo.%@opsvision.example.test"]);
  const organizations = await db.query('SELECT COUNT(*)::int AS total FROM "Organization"');
  console.log({ users: users.rows[0], organizations: organizations.rows[0] });
} finally {
  await db.close();
}
