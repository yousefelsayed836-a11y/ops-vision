# OpsVision development instructions

Read this file, docs/PROJECT_MEMORY.md, docs/ROADMAP.md and docs/KNOWN_ISSUES.md before editing. Read the actual code, inspect git status, and preserve existing functionality. This is a new, independent application; never mutate the reference Emergent site.

Stack: Next.js App Router, strict TypeScript, React, PostgreSQL/Prisma, Better Auth, next-intl. Core domain modules live in src/lib; server endpoints in src/app/api; localized UI in src/app/[locale]; tests in tests. Keep architecture small until a real scaling requirement exists.

Arabic is the default language; English must have equivalent translations. Use logical CSS properties and correct RTL/LTR. Palette: yellow #FFF6B8, pink accents #F8DCE5, background #F7FAF8, teal #3F7773, dark #243D3B, white cards. User explicitly corrected: keep original background; only add small pink accents to homepage, never a site-wide pink background. User requested a typographic OpsVision wordmark, no SVG/icons/emoji/decorative geometry, simple natural wording, no marketing preview/features/steps, and a logo-only footer. Preserve these preferences. QR activation uses functional PNG, not decoration.

Sessions are owned by Better Auth. Never expose secrets or plaintext passwords. No public signup: create users through approved invitations or the local administrator CLI. Authorize every protected server action. Deny by default. Resolve memberships server-side. Never accept an arbitrary browser tenant identifier without checking membership. All tenant-owned relations must remain inside the tenant. Use transactions for provisioning, bay allocation, pricing, transitions, and event processing.

Commands: npm ci; npm run db:generate; npm run db:migrate; npm run dev; npm run lint; npm run typecheck; npm test; npm run test:integration; npm run build. Integration tests need a dedicated TEST_DATABASE_URL. Never run destructive test cleanup on production. No published default admin credentials. Bootstrap via npm run admin:create with inputs on stdin.

Workflow: read → understand → implement a functional vertical slice → test → document → review. Record actual test outcomes and limitations. Maintain all files in docs, especially memory/changelog/roadmap/issues. Never claim integration or deployment without evidence. Camera connectors, external messaging and payments remain unconfigured until tested with real providers. Simulated observations must be isolated to demo tenants and cannot create real payments. No facial recognition or automated employee decisions. Keep AI worker access narrowly scoped.

Production requires a PostgreSQL service, HTTPS, secure secrets, tested backup/restore, email delivery and a running job worker. Do not publish a disconnected static preview as a working SaaS. Unimplemented requirements must be explicitly tracked, never silently omitted.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Sidebar is white with pink selected navigation, dark readable text. Photo is restricted to login background with CSS blur; do not put it back in the homepage.

2026-10-19 user exception: login uses light blue accents/button and a simple car-wash mark beside OpsVision. Scope these to login; keep other page palettes and login blurred background. A CSS car mark is allowed for this requested logo; no SVG or emoji needed.

Latest login logo preference: replace CSS car mark with the generated realistic car + OpsVision integrated transparent PNG at public/assets/opsvision-car-logo.png. Do not restore the rejected CSS icon.

Authoritative latest brand: use public/assets/opsvision-car-logo-connected.png throughout ALL pages/dashboards/footers/receipts. Black Ops, blue Vision and connection to black/white car; compact180px desktop/160px mobile. Current app icon is public/apps/opsvision-icon.png. Do not restore rejected CSS, glossy or disconnected monochrome logos. See docs/BRAND_ASSETS.md.


Latest authoritative preferences (2026-10-19): replace all green UI tones with light blue; maintain dark blue text contrast, white sidebar and pale neutral background. Public/login logo remains blue; internal dashboard/receipts/tracking logo is pink. Organization management is one full-width bordered group per organization, alternating pink and pale blue by stable organization order (search preserves tone). Statistics cards share one pale pink background. Simplified operations-only mode is enabled by default; hide vehicles/video/rules/simulation screens and disable their endpoints/workers. Keep historical records. Only camera IP metadata is editable; do not imply live camera connection. Start/Finish are direct authorized actions; optional inspection remains available. Quick customer is limited tracking access, not a global email account. Never promise forced OS installation.


2026-10-19 new user request supersedes prior video removal: re-enable uploaded-video AI analysis and its explicit video.analyze permission, retaining general rules/simulation disabled. Remove vehicle SIZE from all UI forms, including wash start, booking, quick customer, pricing and video review. Preserve historical DB sizes/prices internally and reuse known size when omitted; no size controls or size columns in the UI. Video detections are evidence, never automatic completed washes or invoices.
