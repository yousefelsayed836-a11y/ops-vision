# OpsVision

Arabic-first bilingual car wash operations application, built independently from the reference site.

**Status:** functional initial vertical slices with real persistence/authentication/authorization and tested operations/automation. This is not yet the complete master specification or a production-ready deployment. Remaining features and provider dependencies are explicitly tracked in docs/ROADMAP.md and docs/KNOWN_ISSUES.md.

## Implemented

- Public Arabic/English homepage and application form.
- Administrative review with transactional, idempotent organization provisioning.
- Expiring one-time invitation, QR and owner credential activation; existing-user invitation acceptance.
- Better Auth sessions, server-side permissions, explicit tenant membership and suspension.
- Branches/bays, opening hours, services with category/size prices and taxes, vehicles, wash lifecycle/history and accepted price snapshots.
- Customer vehicle ownership, conflict-checked booking/cancellation, printed cash receipts and completed-wash feedback.
- Password recovery with encrypted pending delivery, session revocation and delegated role management UI.
- Transactional bay claims, optimistic version checks, timed worker assignments and actual cash recording.
- Persistent notifications/audit; durable event automation with threshold rules, deduplication, retries and dead-letter visibility.
- Isolated camera simulation and human review preserving original observations.
- Honest integration status: real cameras/AI, email/SMS/WhatsApp and online payments are unconfigured.

## Run locally

```text
npm ci
npm run db:generate
node scripts/configure-local.mjs
npm run db:dev
```

In another terminal:

```text
node scripts/migrate-local.mjs
npm run dev
```

Open http://localhost:3000/ar or /en. Provision the first administrator privately with `npm run admin:setup`; its interactive prompt hides the password. No default credentials or public administrator bootstrap endpoint exist. See docs/DEPLOYMENT.md. Start npm run worker for continuous automation; the rule screen can process queued events manually during development.

## Verify

```text
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
```

The integration suite requires a dedicated TEST_DATABASE_URL; no production fallback or destructive cleanup is used. Local databases live under ignored .data. Production uses PostgreSQL/Prisma migrations, not the local PGlite runner.

## Continue safely

Read AGENTS.md, docs/PROJECT_MEMORY.md, docs/ROADMAP.md and docs/KNOWN_ISSUES.md. Actual command outcomes live in docs/TESTING.md. Architecture/API/schema/permissions/business rules/automation/camera/security/deployment are documented separately. Never assume a planned feature is implemented.

Selected colors: #FFF6B8 / #F8DCE5 / #3F7773 / #F7FAF8 / #243D3B. Typographic wordmark, light sidebar, limited pink homepage accents and local Cairo/Inter fonts. The generated car-wash photo is used only as a blurred login background.


Video upload/worker setup and limits: [docs/VIDEO_ANALYSIS.md](docs/VIDEO_ANALYSIS.md). Latest local additions:8 service templates, platform all-bay view/start grants, reversible wash removal, and limited per-wash customer tracking via QR/link/password. Tests/build in docs/TESTING.md. Live camera ingestion and automatic full-wash/category inference remain pending.
