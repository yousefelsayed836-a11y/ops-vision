import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "./db";
import { platform, type Actor } from "./access";
import { platformPermissions } from "./permissions";
import { transaction, audit } from "./transactions";
import { assert } from "./errors";
import { token, digest, seal } from "./crypto";
import { email, text, activationInput } from "./validation";

export const grantedPlatformPermissions = (actor: Actor): readonly string[] =>
  actor.platformRole === "SUPER_ADMIN"
    ? platformPermissions
    : (actor.platformPermissions ?? []);
const selected = z
  .array(z.enum(platformPermissions))
  .max(platformPermissions.length)
  .default([]);
export async function invitePlatformStaff(actor: Actor, raw: unknown) {
  platform(actor, "platform.manage_users");
  const data = z
    .object({ name: text, email, permissions: selected })
    .parse(raw);
  assert(
    data.permissions.every((p) =>
      grantedPlatformPermissions(actor).includes(p),
    ),
    "PRIVILEGE_ESCALATION",
    403,
  );
  const secret = token();
  const rawToken = `p_${secret.raw}`;
  return transaction(async (tx) => {
    assert(
      !(await tx.user.findUnique({ where: { email: data.email } })),
      "MEMBERSHIP_EXISTS",
      409,
    );
    const verification = await tx.verification.create({
      data: {
        id: randomUUID(),
        identifier: `platform-invite:${digest(rawToken)}`,
        value: JSON.stringify({ ...data, issuerId: actor.id }),
        expiresAt: new Date(Date.now() + 24 * 3600000),
      },
    });
    await tx.outbox.create({
      data: {
        kind: "PLATFORM_INVITE",
        recipient: data.email,
        encryptedPayload: seal({
          token: rawToken,
          activationPath: "/ar/activate#",
        }),
      },
    });
    await audit(
      tx,
      actor.id,
      "platform.staff_invited",
      "verification",
      verification.id,
      undefined,
      { permissions: data.permissions },
    );
    return { token: rawToken };
  });
}
export async function activatePlatformStaff(raw: unknown) {
  const data = activationInput.parse(raw);
  const hashed = await hashPassword(data.password);
  return transaction(async (tx) => {
    const record = await tx.verification.findFirst({
      where: {
        identifier: `platform-invite:${digest(data.token)}`,
        expiresAt: { gt: new Date() },
      },
    });
    assert(record, "INVALID_OR_EXPIRED_TOKEN", 400);
    const pending = z
      .object({
        name: text,
        email,
        permissions: selected,
        issuerId: z.string(),
      })
      .parse(JSON.parse(record.value));
    const issuer = await tx.user.findUnique({
      where: { id: pending.issuerId },
    });
    assert(issuer && !issuer.disabled, "INVALID_OR_EXPIRED_TOKEN", 400);
    const actor: Actor = {
      id: issuer.id,
      platformRole: issuer.platformRole,
      platformPermissions: issuer.platformPermissions,
    };
    platform(actor, "platform.manage_users");
    assert(
      pending.permissions.every((p) =>
        grantedPlatformPermissions(actor).includes(p),
      ),
      "PRIVILEGE_ESCALATION",
      403,
    );
    assert(
      !(await tx.user.findUnique({ where: { email: pending.email } })),
      "SIGN_IN_TO_ACCEPT",
      409,
    );
    const claim = await tx.verification.deleteMany({
      where: { id: record.id },
    });
    assert(claim.count === 1, "INVALID_OR_EXPIRED_TOKEN", 409);
    const id = randomUUID();
    await tx.user.create({
      data: {
        id,
        name: pending.name,
        email: pending.email,
        emailVerified: true,
        platformRole: "PLATFORM_ADMIN",
        platformPermissions: pending.permissions,
        platformCreatedBy: issuer.id,
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
    await audit(tx, id, "platform.staff_activated", "user", id);
    return { activated: true };
  });
}
export async function updatePlatformStaff(
  actor: Actor,
  id: string,
  raw: unknown,
) {
  platform(actor, "platform.manage_users");
  const data = z
    .object({ permissions: selected, active: z.boolean() })
    .parse(raw);
  assert(
    data.permissions.every((p) =>
      grantedPlatformPermissions(actor).includes(p),
    ),
    "PRIVILEGE_ESCALATION",
    403,
  );
  return transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id } });
    assert(
      user && user.platformRole === "PLATFORM_ADMIN" && user.id !== actor.id,
      "FORBIDDEN",
      403,
    );
    assert(
      actor.platformRole === "SUPER_ADMIN" ||
        user.platformCreatedBy === actor.id,
      "FORBIDDEN",
      403,
    );
    await tx.user.update({
      where: { id },
      data: { platformPermissions: data.permissions, disabled: !data.active },
    });
    await tx.session.deleteMany({ where: { userId: id } });
    await audit(tx, actor.id, "platform.staff_updated", "user", id, undefined, {
      permissions: data.permissions,
      active: data.active,
    });
    return { updated: true };
  });
}
export async function platformStaff(actor: Actor) {
  platform(actor, "platform.manage_users");
  return db.user.findMany({
    where: {
      platformRole: "PLATFORM_ADMIN",
      ...(actor.platformRole === "SUPER_ADMIN"
        ? {}
        : { platformCreatedBy: actor.id }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      disabled: true,
      platformPermissions: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
