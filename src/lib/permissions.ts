export const platformPermissions = [
  "platform.manage_users",
  "platform.manage_tenants",
  "platform.review_applications",
  "platform.view_reports",
  "platform.view_audit",
  "platform.view_bays",
  "platform.operate_washes",
  "platform.complete_washes",
  "platform.manage_bays",
  "platform.manage_cameras",
] as const;
export const tenantPermissions = [
  "tenant.manage_profile",
  "tenant.manage_branches",
  "tenant.manage_employees",
  "tenant.manage_roles",
  "tenant.manage_services",
  "tenant.manage_bays",
  "tenant.manage_customers",
  "tenant.manage_cameras",
  "tenant.manage_automation",
  "video.analyze",
  "wash.create_session",
  "wash.assign_workers",
  "wash.start_session",
  "wash.pause_session",
  "wash.complete_session",
  "wash.cancel_session",
  "wash.view_sessions",
  "wash.manage_services",
  "reports.view",
  "reports.export",
  "finance.view_revenue",
  "finance.manage_payments",
  "customers.self",
] as const;
export type Permission =
  | (typeof platformPermissions)[number]
  | (typeof tenantPermissions)[number];
export const roles: Record<string, readonly Permission[]> = {
  OWNER: tenantPermissions.filter((p) => ![
    "wash.create_session", "wash.assign_workers", "wash.start_session",
    "wash.pause_session", "wash.complete_session", "wash.cancel_session", "wash.manage_services", "finance.manage_payments",
  ].includes(p)),
  MANAGER: tenantPermissions.filter((p) => p !== "tenant.manage_roles"),
  SUPERVISOR: [
    "wash.view_sessions",
    "wash.manage_services",
    "wash.create_session",
    "wash.assign_workers",
    "wash.start_session",
    "wash.pause_session",
    "wash.complete_session",
    "wash.cancel_session",
    "reports.view",
    "tenant.manage_cameras",
  ],
  CASHIER: [
    "wash.view_sessions",
    "wash.create_session",
    "finance.manage_payments",
    "finance.view_revenue",
  ],
  WORKER: [
    "wash.view_sessions",
    "wash.manage_services",
    "wash.start_session",
    "wash.pause_session",
    "wash.complete_session",
  ],
  CUSTOMER: ["customers.self"],
};
export function isPlatformAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "PLATFORM_ADMIN";
}
export function canDelegate(
  own: readonly string[],
  requested: readonly string[],
) {
  return requested.every(
    (p) =>
      tenantPermissions.includes(p as (typeof tenantPermissions)[number]) &&
      own.includes(p),
  );
}
