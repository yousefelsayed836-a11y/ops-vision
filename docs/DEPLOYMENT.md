# Deployment and local operation

## Current status

Local development server and PostgreSQL-compatible databases have run. No public production URL, Docker run, CI run, real email delivery or real camera integration has been verified. Do not advertise this milestone as a complete production release.

## Local Windows development

Node 24 is used. npm ci, then npm run db:generate. Create local configuration once with node scripts/configure-local.mjs (never overwrites an existing .env). Start npm run db:dev in one terminal. It starts independent, persistent, loopback-only PGlite databases at 51214 and 51224. Apply checked-in SQL using node scripts/migrate-local.mjs. Start npm run dev in a second terminal; open http://localhost:3000/ar. Keep localhost consistent with APP_URL/BETTER_AUTH_URL so origin validation works. npm run worker runs background processing in a third terminal; the UI also permits bounded manual processing for validation.

The pure-JS local migration helper is guarded to development plus these two loopback ports and checks migration checksums. It exists because the sandbox blocks Prisma's native migration executable. For PostgreSQL proper, use npm run db:migrate instead. Do not mix the local helper's ledger with an existing production database.

First administrator: run `npm run admin:setup` in a private local terminal. It prompts for name/email and hides password entry, then invokes admin:create through stdin. Keep the password out of shell arguments, files, logs, history and Git. There is no default account or unauthenticated HTTP bootstrap. Provision only once; the command refuses a second initial super-admin. Platform staff delegation remains pending.

## Production preparation

Provision PostgreSQL 17, separate least-privilege runtime/migration roles, HTTPS endpoint/reverse proxy, cryptographically random auth secret, database connection secret, SMTP/provider credentials and backup keys. APP_URL and BETTER_AUTH_URL must match the external HTTPS origin. Keep .env private; never ship the local configuration. Set APP_ENV=production and ALLOW_SIMULATION=false unless intentionally supporting isolated demo organizations.

infrastructure/Dockerfile has build, migrate, web and worker targets. compose.yaml keeps database private and web bound to loopback for a TLS reverse proxy. Set POSTGRES_PASSWORD, DATABASE_URL (postgres service hostname), auth secret and application URLs privately. Then docker compose up --build. Migrations must complete before web/worker start. Docker is unavailable here, so these container steps require validation on the deployment host.

Windows uses Next's official WASM compiler path and ordinary .next output because native cache checks/path constraints fail under this sandbox. Linux Docker uses standalone output. CI is provided but has not run remotely.

## Backup/recovery

Schedule encrypted pg_dump backups with a policy suited to the business, retain outside the application host, monitor failures, test restoring to a separate PostgreSQL instance, and document recovery point/time objectives. Back up encrypted outbox data and required secret keys consistently; losing the auth secret invalidates sessions and prevents decrypting pending invitation payloads. Keep an audited key-rotation procedure before launch. No successful disaster-recovery exercise is claimed yet.

## Monitoring and restart

Probe /api/health; alert on 503 or worker failure, stale pending/retry records and DEAD jobs. Keep worker supervised with restart policy. Monitor connection pool, storage, query latency, login failures and backup age. Do not log credential-bearing URLs, invitation tokens or video credentials. Application debug logs currently contain event/error type only; production structured tracing and service metrics need expansion.

## Management app installation

All dashboards contain four installation choices (iPhone, Android, Windows, Mac). This is a browser-installed management web app; manifests start at /ar/dashboard or /en/dashboard in standalone mode. Public homepage does not advertise an install manifest. Authentication still applies on launch and expired sessions redirect to login. Nothing caches tenant data or credentials; the management service worker has no fetch cache. Real-device installation has not been verified here.

iPhone uses Safari Share > Add to Home Screen > Open as Web App, with user confirmation. Android/Chrome and desktop Chrome/Edge use beforeinstallprompt when the browser offers it, otherwise the normal browser installation menu. Safari on Mac uses File > Add to Dock. Production needs HTTPS; the current localhost address is local to this computer and cannot be used as a hosted phone app.

Primary references: https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios and https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

## User-requested local demo

A demo organization and three user-chosen-purpose review accounts now exist on the isolated local development database: platform SUPER_ADMIN, car wash OWNER and WORKER. Random passwords are delivered only in the sibling private opsvision-demo-accounts.txt file, outside the project/source archive. No credentials are in source, arguments or logs. scripts/seed-demo.ts is loopback-development-only and refuses overwrite/repeated bootstrap. Do not run against production. Cash recording remains disabled for the demo organization.


For uploaded-video jobs, provision the pinned Python/OpenCV runtime + verified YOLOX model and run npm run video:worker with shared private disk/database. See VIDEO_ANALYSIS.md. Local test is verified; production decoder isolation, retention, process supervision and live gateway remain deployment work.


Current default OPSVISION_OPERATIONS_ONLY=true disables video/automation workers and removed endpoints. Do not supervise those workers in this mode. Apply migration009 and regenerate Prisma before restart. PWA installation needs supported browser and secure origin; localhost is local-PC testing only. A phone cannot use the PC localhost URL. Deploy HTTPS and APP_URL to a real address before mobile use. Manifests start/scope at dashboard only,192/512 approved pink PNG icons; serviceworker uses network only and caches no tenant data.


Video analysis now controlled separately by OPSVISION_VIDEO_ANALYSIS (default true after explicit user request); general rules/simulation remain off with OPSVISION_OPERATIONS_ONLY=true. Start npm run video:worker separately with actual OPSVISION_PYTHON runtime and shared private storage. .data/vision-runtime-current is preferred Python dependency target; fallback historical targets retained.13Python tests verify algorithm, not production detection accuracy. Worker has1850s process timeout, decoder30min source limit, no external media upload. Keep .data private and excluded from archives.
