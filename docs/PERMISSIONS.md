# Authorization

Default deny. src/lib/permissions.ts is the permission registry. SUPER_ADMIN/PLATFORM_ADMIN can review applications and manage organization status. They cannot read tenant operations without an explicit active membership. No public API grants platform roles.

OWNER: tenant permissions; MANAGER: same except custom-role management; SUPERVISOR: operational management plus camera review/reports; CASHIER: check-in and confirmed cash recording; WORKER: view/start/pause/complete; CUSTOMER: own vehicles and wash history/catalog only.

Membership is resolved by actor user ID + organization ID on every request. Organization suspension and membership active status are checked server-side. branchScope verifies delegated branch restrictions on related mutations. Snapshot queries restrict branch-owned resources. Customer identity and ownership are taken from session/membership, not arbitrary customer IDs in JSON.

Invitation creation is restricted to owners/managers and permission subsets. OWNER invitations are only created by registration approval; existing account invitations must be explicitly accepted while signed in. Custom role creation cannot include platform permissions or permissions the caller lacks. Custom role creation/assignment and member access controls have API and workspace UI. Snapshot responses omit money fields when the caller lacks financial visibility; HTTP checks cover a restricted custom reader.

Camera credentials/raw URLs are never returned by snapshots. Notification recipients require the notification's permission and optional recipient ID. Audit logs require privileged visibility.

Security tests cover platform review denial, cross-tenant denial, no implicit platform tenant access, invitation escalation rejection, suspension, ownership token claims and branch guards. Further tests needed for every configurable role combination and full branch privacy of shared vehicle catalogs.

## Explicit staff access (current behavior)

The user explicitly authorized staff accounts for both car wash dashboards and the platform dashboard. New staff forms start with no permissions checked. Tenant STAFF invitations create a private custom role with exactly the selected permissions; no WORKER/MANAGER preset is silently attached. Owner onboarding remains the owner of its organization. Legacy explicitly selected roles are still supported, bounded by the inviter's permissions.

Any tenant member holding tenant.manage_employees may invite/manage colleagues within the member's branch and permission set. They cannot alter OWNER, themselves, another tenant or grant permissions they lack. Changes revoke the target's sessions. Zero-permission members can open an empty workspace but receive no operational records.

SUPER_ADMIN retains platform ownership. PLATFORM_ADMIN has no implicit permissions: User.platformPermissions is authoritative. Staff invitations require platform.manage_users, may only grant a subset, expire in 24 hours, store only hashed tokens and encrypted pending delivery, and recheck the issuer at activation. Existing account credentials are never overwritten. Platform staff editing is limited to the creator's children, or SUPER_ADMIN; self editing and editing SUPER_ADMIN are denied. Platform permissions never grant tenant membership.

Platform snapshot collections are filtered by permission; restricted users cannot see applications/organizations/audit/staff. Camera IP/site network values require the relevant tenant access. Server authorization is mandatory; hidden navigation is not the security boundary.


video.analyze permits private video upload, viewing own authorized branch evidence and appending reviews. OWNER/MANAGER built-ins include it; other roles require explicit grant. Platform role alone does not confer it.


platform.view_bays: view cross-tenant bays/active plates/service choices; platform.operate_washes: create/start a session at a selected active-organization bay. Staff require explicit grants, SUPER_ADMIN includes them. Neither grants blanket tenant membership. tenant.manage_customers issues limited per-wash customer tracking; ordinary worker has no grant.


New explicit platform grants: platform.manage_bays, platform.manage_cameras, platform.complete_washes. Viewing bays alone confers none of these. Tenant quick customer directory/credentials needs tenant.manage_customers; creating its new wash additionally needs wash.create_session; operating existing wash still needs the corresponding wash.start_session/complete_session permission. No default permissions added to custom staff. Daily reports allow wash.view_sessions/reports.view/finance.view_revenue but revenue requires finance.view_revenue.


video.analyze is again visible for explicit staff delegation. Existing OWNER permission continues; no new staff default grants added. Platform administrator alone does not get tenant video access. Optional bay and camera identifiers must match the authorized organization/branch and each other.
