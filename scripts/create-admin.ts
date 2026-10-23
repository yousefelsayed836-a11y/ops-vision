import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import { z } from "zod";
import { email, password } from "../src/lib/validation";
// stdin JSON only: no passwords in arguments, source, defaults, logs or Git.
async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const data = z
    .object({ email, name: z.string().min(2), password })
    .parse(JSON.parse(input));
  const id = randomUUID();
  const hashed = await hashPassword(data.password);
  await db.$transaction(
    async (tx) => {
      if (await tx.user.findFirst({ where: { platformRole: "SUPER_ADMIN" } }))
        throw new Error("Initial administrator already provisioned");
      await tx.user.create({
        data: {
          id,
          email: data.email,
          name: data.name,
          emailVerified: true,
          platformRole: "SUPER_ADMIN",
          accounts: {
            create: {
              id: randomUUID(),
              accountId: id,
              providerId: "credential",
              password: hashed,
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: id,
          action: "platform.bootstrap",
          entityType: "user",
          entityId: id,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
  console.log("Administrator provisioned. No credentials printed.");
}
main()
  .catch(() => {
    console.error(
      "Administrator provisioning failed. Check inputs and database; no credentials logged.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
