# Security status

Implemented controls: Better Auth password hashing/session management; secure cookies in production configuration; disabled public signup; current database user/active tenant checks; server-side RBAC and explicit memberships; composite organization foreign keys; serializable critical writes; Zod validation; controlled origin/content-type mutations; basic auth and application/recovery throttling; random 256-bit token indexes, expiry/revocation/single-use claim; encrypted AES-256-GCM outbox; no credential logging or default administrator password; no camera passwords in browser snapshots; audit records; security headers; native React text escaping; no raw user HTML.

Passwords/tokens must enter provisioning via stdin, not shell arguments or tracked files. .env and .data are ignored. The development .env is generated with a random auth secret; it is not a deployable production secret configuration. PostgreSQL local fallback listens only on loopback. Never expose PGlite to untrusted networks.

Camera/private identifiers are sensitive. No face recognition, biometric matching or video-based payroll decisions. Simulated events cannot alter real tenant revenue; real camera observations require review and future constrained credentials.

Current gaps before production: test RLS/least-privilege PostgreSQL roles, per-request CSP nonces (current Next-compatible CSP still permits inline scripts), trusted reverse-proxy/rate-limit strategy at edge, MFA for platform administration, external email and recovery delivery, encrypted backup/restore test, retention/deletion jobs, full permission/branch field-privacy review, audit export/retention controls and jurisdiction-specific privacy review.

Dependency audit on 2026-10-18: Prisma patched to 7.10.1. npm audit --omit=dev returned zero reported vulnerabilities at the recorded check. Full audit reports 5 high findings in the eslint/fast-glob/micromatch/braces dev-tool chain with no compatible upstream braces fix available; do not downgrade framework tooling merely to hide the report. Recheck lockfile and advisories before deployment.

No production penetration test or security certification is claimed.


Customer tracking stores password/session hashes, exact wash scope, expiry and revocation; password login rate-limited and CSRF Origin checked; session HttpOnly/SameSite Strict with route scope. It grants no tenant/dashboard access. Cross-tenant platform view/start require explicit separately delegable permissions; reversible archives block tenant/tracking access. Private video files require session+tenant/branch checks, bounded size, allowlisted paths and no remote-fetch input. Production decoder isolation/retention remain pending.


CSP media-src self blob permits only private same-origin videos and local preview; no public upload or third-party inference.128MiB multipart bound checked during streaming before parsing, matching source cap. Evidence filenames allowlisted. Detection cache belongs in private analysis directory; never publish .data or credentials. No face matching or employee decisions; no ACL changes performed.
