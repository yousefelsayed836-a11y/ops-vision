import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile, access, unlink, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import { roles } from "../src/lib/permissions";
import { tenant } from "../src/lib/access";
import {
  createWash,
  transitionWash,
  assignWorker,
} from "../src/lib/operations";

// Explicitly requested local review accounts. Never exposed through an HTTP bootstrap.
const credentialsPath = resolve("..", "opsvision-demo-accounts.txt");
async function main() {
  const restoreMode = process.argv.includes("--restore-existing-demo");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.APP_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "51214"
  )
    throw new Error("Local development database required");
  if (!restoreMode) {
    try {
      await access(credentialsPath);
      throw new Error("Access file already exists; refusing to replace credentials");
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  const existingCredentials = restoreMode
    ? [...(await readFile(credentialsPath, "utf8")).matchAll(/البريد:\s*([^\r\n]+)\r?\nكلمة المرور:\s*([^\r\n]+)/g)]
    : [];
  if (restoreMode && existingCredentials.length !== 3)
    throw new Error("Expected three existing demo credentials for local recovery");
  const entries = [
    {
      label: "مدير النظام",
      name: "مدير التجربة",
      email: "demo.admin@opsvision.example.test",
      platformRole: "SUPER_ADMIN",
      role: null,
    },
    {
      label: "صاحب المغسلة",
      name: "صاحب مغسلة التجربة",
      email: "demo.owner@opsvision.example.test",
      platformRole: "NONE",
      role: "OWNER",
    },
    {
      label: "موظف المغسلة",
      name: "موظف التجربة",
      email: "demo.worker@opsvision.example.test",
      platformRole: "NONE",
      role: "WORKER",
    },
  ].map((entry, index) => ({
    ...entry,
    id: randomUUID(),
    password: restoreMode ? existingCredentials[index][2].trim() : randomBytes(18).toString("base64url"),
  }));
  if (restoreMode && entries.some((entry, index) => entry.email !== existingCredentials[index][1].trim()))
    throw new Error("Existing demo credential emails do not match expected accounts");
  if (restoreMode && await db.user.count())
    throw new Error("Recovery is only allowed on an empty local database");
  const hashed = await Promise.all(
    entries.map((entry) => hashPassword(entry.password)),
  );
  const orgId = randomUUID(),
    branchId = randomUUID(),
    bayId = randomUUID(),
    serviceId = randomUUID();
  const vehicles = [randomUUID(), randomUUID()];
  if (
    await db.user.count({
      where: {
        OR: [
          { email: { in: entries.map((e) => e.email) } },
          { platformRole: "SUPER_ADMIN" },
        ],
      },
    })
  )
    throw new Error(
      "Accounts or initial administrator already exist; refusing to overwrite or add another bootstrap",
    );
  if (
    await db.organization.findUnique({
      where: { slug: "opsvision-local-demo" },
    })
  )
    throw new Error("Demo already exists");
  const content = [
    "OpsVision — حسابات التجربة المحلية",
    "http://localhost:3000/ar/login",
    "مغسلة التجربة — بيانات تجريبية، وليست معاملات حقيقية.",
    "احتفظ بالملف عندك ولا ترفعه مع السورس أو تشاركه علنًا.",
    "",
    ...entries.flatMap((entry) => [
      entry.label,
      `البريد: ${entry.email}`,
      `كلمة المرور: ${entry.password}`,
      "",
    ]),
  ].join("\n");
  if (!restoreMode) await writeFile(credentialsPath, content, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  try {
    await db.$transaction(
      async (tx) => {
        // Repeat the initial-admin check within the provisioning transaction.
        if (await tx.user.findFirst({ where: { platformRole: "SUPER_ADMIN" } }))
          throw new Error("Administrator exists");
        for (const [index, entry] of entries.entries())
          await tx.user.create({
            data: {
              id: entry.id,
              name: entry.name,
              email: entry.email,
              emailVerified: true,
              platformRole: entry.platformRole,
              accounts: {
                create: {
                  id: randomUUID(),
                  accountId: entry.id,
                  providerId: "credential",
                  password: hashed[index],
                },
              },
            },
          });
        await tx.organization.create({
          data: {
            id: orgId,
            name: "مغسلة التجربة",
            slug: "opsvision-local-demo",
            isDemo: true,
            currency: "SAR",
          },
        });
        await tx.branch.create({
          data: {
            id: branchId,
            orgId,
            name: "الفرع التجريبي",
            city: "القاهرة",
            timezone: "Asia/Riyadh",
            opensAt: "00:00",
            closesAt: "23:59",
          },
        });
        await tx.washBay.createMany({
          data: [
            { id: bayId, orgId, branchId, name: "حوض 1" },
            { orgId, branchId, name: "حوض 2" },
          ],
        });
        await tx.washService.createMany({
          data: [
            {
              id: serviceId,
              orgId,
              nameAr: "غسيل خارجي",
              nameEn: "Exterior wash",
              price: "150",
              durationMinutes: 20,
            },
            {
              orgId,
              nameAr: "غسيل شامل",
              nameEn: "Full wash",
              price: "250",
              durationMinutes: 40,
            },
          ],
        });
        for (const entry of entries.filter((e) => e.role))
          await tx.membership.create({
            data: {
              orgId,
              userId: entry.id,
              role: entry.role!,
              branchId: entry.role === "WORKER" ? branchId : null,
            },
          });
        await tx.vehicle.createMany({
          data: [
            {
              id: vehicles[0],
              orgId,
              plate: "DEMO-101",
              category: "SEDAN",
              color: "أبيض",
            },
            {
              id: vehicles[1],
              orgId,
              plate: "DEMO-202",
              category: "SUV",
              color: "أسود",
            },
          ],
        });
        await tx.auditLog.create({
          data: {
            orgId,
            actorId: entries[0].id,
            action: "demo.local.provisioned",
            entityType: "organization",
            entityId: orgId,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (!restoreMode) await unlink(credentialsPath);
    throw error;
  }
  const scope = await tenant(
    { id: entries[1].id, platformRole: "NONE" },
    orgId,
    "wash.create_session",
  );
  const wash = await createWash(scope, {
    branchId,
    bayId,
    serviceId,
    vehicleId: vehicles[0],
    notes: "جلسة تجريبية لتجربة متابعة الغسيل",
  });
  await assignWorker(scope, wash.id, entries[2].id);
  await transitionWash(scope, wash.id, "WASHING", wash.version);
  await createWash(scope, {
    branchId,
    serviceId,
    vehicleId: vehicles[1],
    notes: "سيارة تجريبية في الانتظار",
  });
  // Verify persisted roles and no implicit platform membership. No credentials are logged.
  const adminMembers = await db.membership.count({
    where: { userId: entries[0].id },
  });
  if (adminMembers !== 0 || !roles.WORKER.includes("wash.start_session"))
    throw new Error("Role verification failed");
  console.log(
    "Local demo provisioned: 3 accounts, 1 branch, 2 bays, 2 services and 2 wash sessions. Credentials saved privately outside source.",
  );
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error && error.message.startsWith("Accounts")
        ? error.message
        : "Demo provisioning failed; no credentials logged.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
