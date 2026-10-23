import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "./db";
import { audit, transaction, type Tx } from "./transactions";
import { assert } from "./errors";
import { digest, token, seal } from "./crypto";
import { platform, type Actor, type Scope, branchScope } from "./access";
import { roles, canDelegate } from "./permissions";
import { auth } from "./auth";
import { z } from "zod";
import {
  applicationInput,
  applicationDecision,
  activationInput,
  invitationInput,
} from "./validation";

async function invitation(
  tx: Tx,
  data: {
    orgId: string;
    email: string;
    name: string;
    role: string;
    branchId?: string;
    purpose?: string;
  },
  hours = 24,
) {
  const secret = token();
  const record = await tx.invitation.create({
    data: {
      ...data,
      tokenHash: secret.hash,
      expiresAt: new Date(Date.now() + hours * 3600000),
    },
  });
  await tx.outbox.create({
    data: {
      orgId: data.orgId,
      kind: data.purpose === "RESET" ? "PASSWORD_RESET" : "INVITATION",
      recipient: data.email,
      encryptedPayload: seal({ token: secret.raw, invitationId: record.id }),
    },
  });
  return {
    invitationId: record.id,
    token: secret.raw,
    expiresAt: record.expiresAt,
  };
}
export async function registerApplication(raw: unknown) {
  const data = applicationInput.parse(raw);
  return transaction(async (tx) => {
    const existing = await tx.application.findFirst({
      where: {
        email: data.email,
        status: {
          in: [
            "PENDING",
            "UNDER_REVIEW",
            "MORE_INFORMATION_REQUIRED",
            "APPROVED",
          ],
        },
      },
    });
    assert(!existing, "APPLICATION_EXISTS", 409);
    const result = await tx.application.create({
      data: { ...data, history: { create: { toStatus: "PENDING" } } },
    });
    await tx.notification.create({
      data: {
        type: "REGISTRATION_APPLICATION",
        permission: "platform.review_applications",
        message: data.businessName,
      },
    });
    await audit(tx, null, "application.submitted", "application", result.id);
    return { id: result.id, status: result.status };
  });
}
export async function createOrganizationWithOwner(actor: Actor, raw: unknown) {
  platform(actor, "platform.manage_tenants");
  const data = applicationInput.parse(raw);
  return transaction(async (tx) => {
    const existing = await tx.user.findUnique({where:{email:data.email}});
    assert(!existing, "SIGN_IN_TO_ACCEPT", 409);
    const org = await tx.organization.create({
      data: {name:data.businessName, slug:`wash-${randomUUID().slice(0,8)}`,currency:'SAR'},
    });
    await tx.branch.create({data:{orgId:org.id,name:data.businessName,city:data.city,timezone:'Asia/Riyadh'}});
    const ownerInvitation = await invitation(tx, {orgId:org.id,email:data.email,name:data.ownerName,role:"OWNER"});
    await audit(tx,actor.id,"organization.created","organization",org.id,org.id);
    return {id:org.id,name:org.name,slug:org.slug,invitation:ownerInvitation};
  });
}
export async function reviewApplication(
  actor: Actor,
  id: string,
  raw: unknown,
) {
  platform(actor, "platform.review_applications");
  const data = applicationDecision.parse(raw);
  return transaction(async (tx) => {
    const app = await tx.application.findUnique({ where: { id } });
    assert(app, "NOT_FOUND", 404);
    if (app.status === "APPROVED" && data.status === "APPROVED")
      return {
        id: app.id,
        orgId: app.orgId,
        status: "APPROVED",
        alreadyProcessed: true,
      };
    assert(
      !["APPROVED", "REJECTED"].includes(app.status),
      "APPLICATION_FINALIZED",
      409,
    );
    let ownerInvitation;
    let orgId = app.orgId;
    if (data.status === "APPROVED") {
      const org = await tx.organization.create({
        data: { name: app.businessName, slug: `wash-${app.id.slice(0, 8)}`, currency: 'SAR' },
      });
      orgId = org.id;
      await tx.branch.create({
        data: { orgId, name: app.businessName, city: app.city, timezone: 'Asia/Riyadh' },
      });
      ownerInvitation = await invitation(tx, {
        orgId,
        email: app.email,
        name: app.ownerName,
        role: "OWNER",
      });
    }
    await tx.application.update({
      where: { id },
      data: {
        status: data.status,
        note: data.note,
        orgId,
        history: {
          create: {
            fromStatus: app.status,
            toStatus: data.status,
            actorId: actor.id,
            note: data.note,
          },
        },
      },
    });
    await audit(
      tx,
      actor.id,
      `application.${data.status.toLowerCase()}`,
      "application",
      id,
      orgId ?? undefined,
    );
    return { id, orgId, status: data.status, invitation: ownerInvitation };
  });
}
export async function activate(raw: unknown) {
  const data = activationInput.parse(raw);
  const hashed = await hashPassword(data.password);
  return transaction(async (tx) => {
    const invite = await tx.invitation.findUnique({
      where: { tokenHash: digest(data.token) },
    });
    assert(
      invite &&
        !invite.usedAt &&
        !invite.revokedAt &&
        invite.expiresAt > new Date(),
      "INVALID_OR_EXPIRED_TOKEN",
      400,
    );
    const org = await tx.organization.findUnique({
      where: { id: invite.orgId },
    });
    assert(org?.status === "ACTIVE", "ACCOUNT_UNAVAILABLE", 403);
    const existing = await tx.user.findUnique({
      where: { email: invite.email },
    });
    // Existing users must sign in and explicitly accept invitations, not reset credentials via a tenant invite.
    assert(!existing || invite.purpose === "RESET", "SIGN_IN_TO_ACCEPT", 409);
    const claim = await tx.invitation.updateMany({
      where: {
        id: invite.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    assert(claim.count === 1, "INVALID_OR_EXPIRED_TOKEN", 409);
    let userId = existing?.id;
    if (invite.purpose === "RESET") {
      assert(existing && !existing.disabled, "INVALID_OR_EXPIRED_TOKEN");
      const result = await tx.account.updateMany({
        where: { userId: existing.id, providerId: "credential" },
        data: { password: hashed },
      });
      assert(result.count === 1, "INVALID_OR_EXPIRED_TOKEN");
      await tx.session.deleteMany({ where: { userId: existing.id } });
      await tx.invitation.updateMany({
        where: { email: invite.email, purpose: "RESET", usedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      userId = randomUUID();
      await tx.user.create({
        data: {
          id: userId,
          email: invite.email,
          name: invite.name,
          emailVerified: true,
          accounts: {
            create: {
              id: randomUUID(),
              providerId: "credential",
              accountId: userId,
              password: hashed,
            },
          },
        },
      });
      await tx.membership.create({
        data: {
          orgId: invite.orgId,
          userId,
          role: invite.role,
          branchId: invite.branchId,
        },
      });
    }
    await audit(
      tx,
      userId ?? null,
      invite.purpose === "RESET"
        ? "user.password_reset"
        : "invitation.activated",
      "invitation",
      invite.id,
      invite.orgId,
    );
    return { activated: true };
  });
}
export async function acceptInvitation(actor: Actor, rawToken: string) {
  return transaction(async (tx) => {
    const invite = await tx.invitation.findUnique({
      where: { tokenHash: digest(rawToken) },
    });
    const user = await tx.user.findUnique({ where: { id: actor.id } });
    assert(
      invite &&
        user &&
        invite.email === user.email &&
        invite.purpose === "ACTIVATE" &&
        !invite.usedAt &&
        !invite.revokedAt &&
        invite.expiresAt > new Date(),
      "INVALID_OR_EXPIRED_TOKEN",
    );
    const org = await tx.organization.findUnique({
      where: { id: invite.orgId },
    });
    assert(org?.status === "ACTIVE", "ACCOUNT_UNAVAILABLE", 403);
    await tx.invitation.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
    assert(
      !(await tx.membership.findUnique({
        where: { userId_orgId: { userId: actor.id, orgId: invite.orgId } },
      })),
      "MEMBERSHIP_EXISTS",
      409,
    );
    await tx.membership.create({
      data: {
        userId: actor.id,
        orgId: invite.orgId,
        role: invite.role,
        branchId: invite.branchId,
      },
    });
    await audit(
      tx,
      actor.id,
      "invitation.accepted",
      "invitation",
      invite.id,
      invite.orgId,
    );
    return { accepted: true };
  });
}
export async function inviteMember(scope: Scope, raw: unknown) {
  const data = invitationInput.parse(raw);
  assert(
    scope.permissions.includes("tenant.manage_employees"),
    "FORBIDDEN",
    403,
  );
  const custom = await db.role.findUnique({
    where: { orgId_name: { orgId: scope.orgId, name: data.role } },
  });
  const explicit = data.role === "STAFF" || data.permissions !== undefined;
  const requested = explicit
    ? (data.permissions ?? [])
    : (custom?.permissions ?? roles[data.role]);
  assert(
    requested &&
      data.role !== "OWNER" &&
      canDelegate(scope.permissions, requested),
    "PRIVILEGE_ESCALATION",
    403,
  );
  if (data.branchId) {
    branchScope(scope, data.branchId);
    assert(
      await db.branch.findFirst({
        where: { id: data.branchId, orgId: scope.orgId },
      }),
      "NOT_FOUND",
      404,
    );
  }
  return transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: data.email },
    });
    assert(
      !existingUser ||
        !(await tx.membership.findUnique({
          where: {
            userId_orgId: { userId: existingUser.id, orgId: scope.orgId },
          },
        })),
      "MEMBERSHIP_EXISTS",
      409,
    );
    await tx.invitation.updateMany({
      where: {
        orgId: scope.orgId,
        email: data.email,
        purpose: "ACTIVATE",
        usedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    const role = explicit ? `STAFF-${randomUUID()}` : data.role;
    if (explicit)
      await tx.role.create({
        data: { orgId: scope.orgId, name: role, permissions: [...requested] },
      });
    const result = await invitation(tx, {
      name: data.name,
      email: data.email,
      branchId: data.branchId ?? scope.branchId ?? undefined,
      role,
      orgId: scope.orgId,
    });
    await audit(
      tx,
      scope.actor.id,
      "invitation.created",
      "invitation",
      result.invitationId,
      scope.orgId,
      { role: data.role },
    );
    return result;
  });
}
export async function requestReset(raw: unknown) {
  const data = (await import("zod")).z
    .object({ email: (await import("./validation")).email })
    .parse(raw);
  await auth.api.requestPasswordReset({ body: { email: data.email } });
  return { accepted: true }; // identical response whether the account exists or not
}
export async function resetPassword(raw: unknown) {
  const data = z
    .object({
      token: z.string().min(16).max(256),
      newPassword: (await import("./validation")).password,
    })
    .parse(raw);
  await auth.api.resetPassword({ body: data });
  return { reset: true };
}
