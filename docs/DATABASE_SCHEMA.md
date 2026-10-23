# Database schema

Source of truth: prisma/schema.prisma and six checked-in SQL migrations. Current schema has 31 models.

- User/Session/Account/Verification/AuthRateLimit: Better Auth identity, credential hashes, revocable sessions and throttling.
- Organization/Membership/Role: tenant, branch-scoped membership and delegated custom permissions.
- Application/ApplicationHistory: durable registration request and administrative review history.
- Invitation: hashed one-time activation/reset token index, expiry, revocation and claim timestamp.
- Branch/WashBay/WashService/Vehicle/Wash: operational records; accepted price, service names, currency and estimate are copied to each wash.
- WashHistory/WashWorker: immutable lifecycle observations and timed worker participation.
- Payment: actual cash-receipt records, idempotent reference per tenant. No card data or provider settlement is fabricated.
- Camera/Observation/ObservationReview: metadata, simulated evidence and separate corrections.
- AutomationRule/AutomationEvent/AutomationExecution: tenant-aware rules, durable retries and event/rule idempotency.
- Notification/AuditLog/Outbox/RateLimit: authorized alerts, accountability, encrypted pending delivery and API abuse controls.

Composite foreign keys constrain branch/bay/service/vehicle/wash references to the same organization. Additional same-tenant checks apply in the service layer. Unique [orgId,key] prevents duplicate events; unique [eventId,ruleId] prevents repeated effects. Bay activeWashId and transactional AVAILABLE→OCCUPIED claim prevent double allocation; the referenced wash is checked by application logic. Tenant deletion is restricted; no destructive cascade wipes operational history.

Money uses DECIMAL(12,2), never floating-point database columns. Display conversion happens only for formatting; database values are serialized as decimal strings. Service durations are positive integer minutes validated at API ingress. Business times use server time; branch timezone is stored for presentation.

Bookings are Wash records in BOOKED state with bookedFor/reservedUntil. Branch hours/timezone constrain booking; overlap is checked transactionally. Service category/size price matrices and taxes are persisted; wash totals snapshot accepted values. Feedback is owned by a customer and requires their completed wash.

Current limitations: one service per session; add-ons, refunds, formal tax invoices/subscriptions, explicit employee schedules and configurable category entities are not yet implemented. RLS has not been enabled; tested application scoping plus composite constraints are the current isolation controls. Do not claim database-level RLS protection.

Production migrations: prisma migrate deploy. Local Windows fallback: scripts/migrate-local.mjs applies the same SQL with a SHA-256 ledger, restricted to the two loopback development ports. Never run that helper against production.

## Staff and device revision

Migrations 005 and 006 add explicit platform permission arrays/creator ownership and organization/camera IP metadata. No extra models. All six migrations applied to both isolated local databases. Platform invitations use hashed Verification identifiers plus encrypted outbox payloads; they never store plaintext activation tokens in queryable fields. Staff changes are audited; revocation invalidates active sessions. No server fetch to user-supplied IPs was added.


Migration007 adds VideoAnalysis durable jobs (source digest, own branch/camera, status, attempts, lock, immutable result JSON) and append-only VideoAnalysisReview (human category,size,service,completion annotation). Composite tenant foreign keys constrain branch/camera/service references. Media remains private local disk, not public assets.


Migration008 CustomerTracking: composite org/wash FK, hashed password and session secret, explicit link/session expiry and revocation. No plaintext passwords or session tokens persisted.


Migration009 adds org-owned CustomerProfile(id,orgId,name,phone,createdAt,updatedAt), unique orgId/phone and composite id/orgId. Wash.customerProfileId optional composite FK ensures same organization. Existing customer User and CustomerTracking models preserved. Applied dev/test; regenerate Prisma and restart long-running dev process after schema change.
