# API contract

Base: /api/v1. JSON mutations require Content-Type application/json and an Origin matching APP_URL. Responses are no-store. Errors use {error:CODE}, optionally validated field names/codes; no stack/secret response. Domain HTTP statuses: 400 invalid input, 401 unauthenticated, 403 forbidden/origin/suspended, 404 not found, 409 conflict/stale state, 422 schema validation, 429 throttling.

Public:
- POST /applications: businessName, ownerName, email, phone, city, branchCount. Persist pending request. Throttled.
- POST /activate: token, password. One-time claim.
- POST /forgot-password: email. Generic response; encrypted outbox; no delivery provider configured.
- POST /reset-password: token, newPassword; hashed one-use verification identifier and existing-session revocation.
- GET /api/health: readiness database SELECT 1; explicit unconfigured integrations.

Identity:
- /api/auth/*: Better Auth sign-in, sign-out, session endpoints. Self-signup disabled.
- GET /me: current user and active tenant memberships.
- POST /accept-invitation: token; requires signed-in user matching invite email.

Platform authorization:
- GET /platform: application/org administrative snapshot, limited audit.
- POST /platform/applications/:id/decision: status, note. Idempotent approval; one-time activation token is returned only to the reviewer and not logged.
- PATCH /platform/organizations/:id: ACTIVE/SUSPENDED.
- POST /platform/demo: create explicitly simulated organization when enabled.

Tenant base /tenants/:orgId (all resolve membership + permission server-side):
- GET /snapshot: role/permission-filtered records, bounded lists (100/200 currently); no raw camera secrets.
- POST /branches, /bays, /services, /vehicles, /washes, /invitations, /roles, /cameras, /rules.
- PATCH /services/:id, /rules/:id, /notifications/:id.
- DELETE /invitations/:id: revocation only; no permanent operational deletion.
- POST /washes/:id/transition: to, version, optional bayId.
- POST /washes/:id/workers: userId.
- POST /washes/:id/cash-payment: reference; full confirmed cash amount.
- POST /bookings: branchId, bayId, serviceId, vehicleId, bookedFor. Validates ownership, branch hours and overlap.
- POST /washes/:id/cancel-booking: version; customer ownership and cancellation policy checked.
- GET /washes/:id/receipt: authorized own customer or financial access, requires recorded payment.
- POST /washes/:id/feedback: rating/comment; own completed wash only.
- PATCH /members/:id: delegated role/branch/active controls; permission subsets enforced.
- POST /simulation: demo-only normalized camera observation.
- POST /automation-process: process up to 20 due events of this organization.
- POST /observations/:id: decision CONFIRMED/REJECTED and review note.

Exact field validators: src/lib/validation.ts. This first API uses bounded snapshots rather than full cursor pagination; pagination/filters/export expansion is tracked, not claimed finished. No service-authenticated real camera ingress exists yet.

## New account and network endpoints

- POST /platform/staff: name, email, permissions (default empty). Authenticated, subset-limited invitation; token is shown once for activation.
- PATCH /platform/staff/:id: permissions, active. Owner/creator hierarchy and subset rules; existing sessions revoked.
- POST /activate supports platform p_ invitation tokens as well as tenant invitation tokens. No public privileged bootstrap exists.
- POST /tenants/:orgId/invitations now accepts permissions, with role default STAFF. Empty permissions create an empty account. Legacy explicitly supplied roles remain bounded.
- PATCH /tenants/:orgId/members/:id accepts permissions and active; creates exact custom grant and revokes sessions. OWNER and self protected.
- PATCH /tenants/:orgId/organization-settings accepts siteIp (IPv4/IPv6, blank clears).
- POST /tenants/:orgId/cameras accepts ipAddress (IPv4/IPv6). Organization is always derived from the checked tenant URL and branch/bay references must match. Saving an IP never probes a URL or claims connectivity.
- /apps/ar.webmanifest and /apps/en.webmanifest start and scope the installable web app to the corresponding dashboard. Manifest metadata is attached only on dashboard pages.


Video endpoints (all require active tenant membership + video.analyze and branch scope): POST /api/v1/tenants/:org/videos accepts multipart video (MP4 ≤48MiB) and config JSON {branchId,cameraId?,zone?} and returns202; GET same lists30 latest; GET /:id returns status/report/review history; GET /:id/files/source|report|Vddd.jpg serves private media (source supports byte ranges); POST /:id/reviews accepts trackId,category,size,serviceId?,washed:boolean|null,note. Upload requires exact APP_URL Origin, bounded body and rate limit. No arbitrary URLs or filesystem paths. See VIDEO_ANALYSIS.md.


Platform: GET /api/v1/platform/bays requires platform.view_bays and returns at most500 active-organization bays with their active wash/service choices. POST /platform/start-wash requires platform.operate_washes and {orgId,bayId,serviceId,vehicle:{plate,category,size}}; validates active organization/branch, own service and compatible category, atomically claims bay and creates WASHING session/history/event. PATCH /platform/organizations/:id accepts ARCHIVED as reversible removal (same manage_tenants grant).
POST /tenants/:org/washes/:id/tracking requires tenant.manage_customers + branch scope; returns one-time password,url,expiry and revokes older links. POST /tracking/:id/login exchanges password for path-scoped HttpOnly cookie (8 attempts/5min). GET /tracking/:id returns only that wash status/service/history/plate; requires valid session and ACTIVE organization. No account/email creation or normal tenant access.


Simplified operation routes: POST tenants/:org/wash-entry accepts branchId,bayId,serviceId,vehicle{plate,category,size},startNow; existing POST washes/:id/transition accepts to/version/bayId and supports direct WASHING/COMPLETED. GET tenants/:org/statistics?date=YYYY-MM-DD|all returns timezone-based daily aggregates; available is current, revenue omitted without grant. GET/POST tenants/:org/customers requires tenant.manage_customers; quick creation accepts name,phone,bayId,plate,category,size,serviceId (service required only if new wash), returns one-time tracking password/link. PATCH tenants/:org/bays/:id manages name/status; POST tenants/:org/camera-ip accepts bayId/ipAddress. Platform POST/PATCH bays uses orgId, explicit manage_bays; POST platform/camera-ip uses explicit manage_cameras. POST platform/washes/:id/transition requires orgId,to/version and distinct operate_washes or complete_washes grant. GET platform/bays now returns organizations,bays,services; camera IP omitted without camera grant. Default operations-only mode returns410 FEATURE_REMOVED for video/rules/simulation/automation-process/observations routes.


Video routes explicitly restored independently of general automation. Config accepts optional bayId (same org/branch and consistent with selected camera), rotation0/90/180/270, zoneAnchor center|bottom, recordingStartedAt ISO offset, sampleFps0.2..6. Files up to128MiB; videos up to30min, local timeout30min. Report v2 includes per-track visits with observed entry/exit, partial flags/null duration, sample uncertainty, zoneSummary and review-required reasons; no automatic operational writes. Detail may include processing progress. Size omitted in client requests: known vehicle retains existing internal size; new vehicle uses existing internal default. Video review size defaults UNKNOWN; no selector exposed.
