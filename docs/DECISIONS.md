# Architecture decision record

2026-10-18:

1. Start a new independent project because no repository/application exists here. Do not alter the reference Emergent service.
2. Use Next.js/TypeScript/PostgreSQL/Prisma/Better Auth as requested; no static dashboard pretending to have persistence.
3. Establish the registration/approval/activation vertical slice first, then working operations and event automation.
4. PostgreSQL durable queue is the current equivalent to Redis/BullMQ. Commit domain events atomically with business changes, then process idempotently. Redis can be introduced behind an outbox relay when measured throughput requires it.
5. No public credential signup. Provision first administrator via private stdin CLI and invite users through controlled workflows.
6. Deliver no imaginary external integrations. Restricted outbox explicitly records provider-unconfigured; cameras are metadata/simulation only; cash recording is separate from online settlement.
7. Use independent development/test PGlite servers because native database tools/Docker are absent and the sandbox blocks Prisma's native migration executable. Apply identical migration SQL with an explicit local-only checksum ledger. Production remains PostgreSQL + Prisma migrations.
8. Use Next's official WASM compiler path in this Windows sandbox because native SWC cache validation rejects the sandbox ACL. No ACL/security protection was weakened. next-intl request alias is configured directly to avoid its optional native message precompiler. Linux builds keep normal native compilation.
9. Windows local builds omit standalone packaging because nested output paths exceed/trigger sandbox path constraints. Linux Docker uses the standalone target. Production container execution is not yet verified.
10. Bundle Cairo/Inter locally, so the security policy need not trust external font CDNs.


Use reversible archive for requested wash removal to preserve operational records and allow recovery. Use limited wash-tracking credentials rather than creating a global account with a car-wash-known reusable password. Use local OpenCV/YOLOX for actual test observations and preserve unknowns where evidence is insufficient; fine categories and wash activity require additional measured development.
