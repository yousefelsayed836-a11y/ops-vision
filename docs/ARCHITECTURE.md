# Architecture

Next.js 16 App Router serves Arabic/English public pages, a permission-filtered workspace, Better Auth routes and versioned JSON APIs. Browser → authenticated API → domain services → Prisma → PostgreSQL. API validation is Zod. Session/cookie management is delegated to Better Auth; authorization is application-owned and evaluated on the server for every protected operation.

Domain modules: access, onboarding, operations, automation, transactions, crypto, validation, HTTP. Pure lifecycle/time rules are in domain.ts. UI resides in components/ops-app.tsx and uses reusable form/dialog primitives. It currently remains one workspace component and should be split by feature as the next modules grow.

Hierarchy: platform → organization/tenant → branch → bay → wash. Organization memberships are explicit, including for platform administrators. A platform role does not implicitly allow tenant operational data access. Branch-scoped memberships restrict branch-related actions.

PostgreSQL is authoritative. Serializable transactions protect provisioning, invitation use, bay claiming, price snapshots, session transitions and event effects. Durable event/outbox tables are written in the same transaction as business events. The automation worker polls due records; claim and effects occur atomically. Unique indexes protect event/rule idempotency.

Queue choice: PostgreSQL transactional durable queue instead of Redis/BullMQ for the first deployable slice. This avoids distributed dual writes and unnecessary infrastructure. Add an outbox relay + Redis only after measured load justifies it. No real inference runs in the web process.

Local testing uses two separate persistent PGlite PostgreSQL-compatible instances on loopback ports 51214/51224 because Docker and a native PostgreSQL executable are unavailable. This verifies queries/transactions against a real PostgreSQL engine in WASM; it does not replace multi-connection PostgreSQL production validation. CI targets PostgreSQL proper.

No production deployment, external messages, remote payments, video streams, plate reading or worker identification has been verified. See ROADMAP.md for explicit incomplete requirements.


Video uploads use a separate persistent job worker and private filesystem; raw machine observations remain separate from operational washes and human review. Global platform bay operations are explicitly authorized per endpoint and reuse transaction-safe domain pricing/bay claims. Customer tracking has independent scoped cookie access to one wash and does not create or impersonate normal authenticated users.
