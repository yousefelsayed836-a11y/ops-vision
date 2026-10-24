import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { assert } from "./errors";
import { isPlatformAdmin, roles, type Permission } from "./permissions";
export type Actor = {
  id: string;
  platformRole: string;
  platformPermissions?: readonly string[];
};
export type Scope = {
  actor: Actor;
  orgId: string;
  branchId: string | null;
  role: string;
  permissions: readonly string[];
  isDemo: boolean;
};
export async function currentActor(): Promise<Actor> {
  const session = await auth.api.getSession({ headers: await headers() });
  assert(session, "UNAUTHENTICATED", 401);
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  assert(user && !user.disabled, "UNAUTHENTICATED", 401);
  return {
    id: user.id,
    platformRole: user.platformRole,
    platformPermissions: user.platformPermissions,
  };
}
export function platform(actor: Actor, permission: Permission) {
  assert(
    permission.startsWith("platform.") &&
      isPlatformAdmin(actor.platformRole) &&
      (actor.platformRole === "SUPER_ADMIN" ||
        actor.platformPermissions?.includes(permission)),
    "FORBIDDEN",
    403,
  );
}
export async function tenant(
  actor: Actor,
  orgId: string,
  permission?: Permission,
): Promise<Scope> {
  const member = await db.membership.findUnique({
    where: { userId_orgId: { userId: actor.id, orgId } },
    include: { org: true },
  });
  // Platform role alone intentionally does NOT grant tenant data access.
  assert(member?.active && member.org.status === "ACTIVE", "FORBIDDEN", 403);
  const custom = await db.role.findUnique({
    where: { orgId_name: { orgId, name: member.role } },
  });
  const basePermissions = member.role === "OWNER"
    ? (custom?.permissions ?? roles.OWNER).filter((permission) => roles.OWNER.includes(permission as (typeof roles.OWNER)[number]))
    : custom?.permissions ?? roles[member.role] ?? [];
  // Keep service controls for managers whose custom role predates these permissions.
  const permissions = member.role === "MANAGER"
    ? [...new Set([...basePermissions, "tenant.manage_services", "wash.manage_services"])]
    : member.role === "OWNER" ? [...new Set([...basePermissions,"tenant.manage_bays","tenant.manage_services"])] : basePermissions;
  return {
    actor,
    orgId,
    branchId: member.branchId,
    role: member.role,
    permissions,
    isDemo: member.org.isDemo,
  };
}
export function branchScope(scope: Scope, branchId: string) {
  assert(!scope.branchId || scope.branchId === branchId, "FORBIDDEN", 403);
}
