# Changelog

## 2026-10-18 — Initial functional implementation (in progress)

Files: project/package/config files; src/app, components, i18n, messages; src/lib/{auth,access,onboarding,operations,automation,crypto,domain,errors,http,permissions,transactions,validation}; Prisma schema/migration; scripts; unit/integration tests; docs and AGENTS.

Features: independent bilingual Arabic-first application, original SVG logo and selected palette, public registration/login/activation, persistent review and idempotent tenant provisioning, private invitation/QR activation, Better Auth credentials/sessions, explicit tenant RBAC, organization suspension, branches/bays/services/vehicles, transactional session lifecycle/price snapshots/worker assignments, confirmed cash receipts, durable automation rules/events/retries and isolated camera simulation/human review.

Database: initial PostgreSQL schema and SQL migration, composite tenant references and idempotency indexes. Local SQL application used a restricted helper due blocked native migration executable.

APIs: versioned /api/v1 dispatcher and /api/auth integration, health/readiness. Mutations enforce origin+JSON; permission checks live server-side.

Security: no default credentials, SHA-256 token indexes, AES-GCM encrypted outbox, one-time claims, audited decisions, no implicit platform access to tenant records. Prisma updated to 7.10.1. Production dependency audit clean at baseline; unresolved dev-tool advisories recorded.

Verification: 14 unit + 26 database integration tests passed. Typecheck and lint baseline passed. Public Arabic page inspected in actual browser. Build compilation/typecheck passed; final packaging rerun pending Windows configuration fix. No deployment or real camera/provider integration claimed.

Next: complete missing customer booking/receipts/feedback, pricing/finance extensions, full permission management UI, reporting filters/exports, provider delivery and production deployment/backup validation. Phase 10 depends on actual camera/network/data inputs. See ROADMAP/KNOWN_ISSUES.

## 2026-10-18 — Customer and verification milestone

Added customer ownership, transactional booking overlap checks/hours/cancellation, category/size service price matrix and tax snapshots, post-payment receipt printing, completed-wash feedback, platform application alerts, recovery with hashed token identifiers/encrypted pending delivery/session revocation, custom role/member access UI and financial field privacy. Four SQL migrations total. Private hidden-password admin:setup CLI provided; no web bootstrap or default account.

Verification: final build/lint/typecheck PASS; 15 unit + 37 database tests; 40 built-server HTTP checks; browser evidence for Arabic/English registration and 390px public homepage. Earlier initial milestone counts above are historical. Full authenticated/mobile/a11y QA and production/provider deployment remain pending. See ROADMAP.md for full remaining requirements.

## User-directed visual revision

Removed all authored inline SVG/Lucide icons and public SVG logo/favicon files; typographic OpsVision identity replaces them. Icon-only actions now have localized text. Removed decorative geometry, product bay mockup, features and numbered journey sections. Simplified Arabic/English public copy. Footer now logo only. User corrected background intent: retain original off-white globally, with limited pink accents on homepage CTA/button. Development preview runs on :3000 using separate .next-dev output and hidden framework indicator. Backend unchanged.

## Latest user-directed milestone

Implemented staff accounts in both tenant and platform dashboards, explicit empty-by-default permission selection, bounded delegation and protected owner/self/hierarchy edits. Platform expansion was explicitly confirmed by user after automatic review requested scope clarification. Added local demo org + 3 accounts, verified sign-ins. Added management web app installation panel/manifest/service-worker shell for four devices; real device installation remains untested. Added organization/site IP and per-camera validated IP with existing tenant/branch/bay linkage; no real connector/inference implemented.

Visual state: original off-white background, small pink homepage accents, text-only logo, no SVG/icons/emoji or eyebrow subtitles. Removed requested preview/features/steps and unnecessary auth/workspace helper text. All public/workspace footers now logo only. Latest request replaces dark sidebar with white/pink active state and adds generated car-wash homepage photo. See IMAGE_ASSETS.md for saved asset and final prompt.

Final placement correction: car-wash image moved off homepage to a blurred login-only background, with crisp form and light overlay. Sidebar changed from dark to white with pink selection. No new backend changes in this final cosmetic correction.


2026-10-18 video milestone: migration007, video.analyze permission, private MP4 upload/range playback/evidence, queue worker, actual YOLOX-S detection/tracking, normalized area observation intervals, append-only reviews and deduplicated video.analysis_completed event. Added first real clip measurement and explicit separation of observations from completed washes. No production live camera integration claimed.


Dashboard follow-up: removed audit and integrations navigation, added8 verified reference service templates + FULL_SIZE_SUV, reversible platform organization removal, separately granted cross-tenant bay view/operation, atomic start-in-bay, and password/QR/link private per-wash customer tracking. Migration008. No prices fabricated; templates require owner price/duration.


2026-10-19: User requested light blue instead of green specifically on login and a car/car-wash mark beside OpsVision. Login-only CSS variables/buttons/links/focus changed to blue with dark readable text; optional CSS-drawn car/water mark enabled for login header/footer only (no SVG/emoji). This explicit request supersedes the older text-only logo preference for login. Existing blurred photo and all other page colors preserved. Browser verified actual blue button and car wordmark; lint/typecheck results in TESTING.md.


2026-10-19 logo correction: user rejected CSS car icon and requested a realistic car integrated with OpsVision. Generated transparent integrated automotive wordmark with built-in image_gen; copied unchanged to public/assets/opsvision-car-logo.png and enabled through existing login car prop for header/footer. Removed CSS car drawing. Login blue styling and blurred photo preserved; other logos remain typographic. Prompt/provenance: LOGO_PROMPT.md. Actual login header inspected in-browser and screenshot ../opsvision-login-realistic-logo.jpg saved.


2026-10-19 final brand: user selected black Ops, blue Vision with V-to-car roof connection and redesigned black/white car, then requested it system-wide. Approved asset public/assets/opsvision-car-logo-connected.png now shared by every Logo instance: public pages, login, sidebar, receipts, customer tracking and footers. Compact 180/160px header and170px sidebar/footer. Square generated app asset1254x1254 added to manifests/favicon/Apple metadata, unchanged copies; generator no longer recreates old typography. Details and exact built-in imagegen prompts in BRAND_ASSETS.md. Actual homepage header inspected successfully. Earlier logo directions are superseded; no extra page palette changes.


2026-10-19: Simplified operations, direct start/finish and bay administration; organization groups alternating pink/light blue; all green UI replaced by light blue; pink internal branding; daily statistics; quick customer directory/tracking access; camera-IP-only operation; removed video/automation UI/runtime default; corrected PWA prompt/fallback and icon dimensions. Migration009 required. Verified19 unit/60 integration/19 HTTP checks plus production build, lint/typecheck.


2026-10-19 start-button correction: platform start choices previously appeared inline above organization bays, outside the scrolled viewport. Replaced with native modal dialog opened immediately on selection, with plate/category/size/service and explicit start/cancel; errors remain visible inside dialog. Browser actually opened demo bay1, selected Sedan/Medium/Exterior, started UI-START-1019, verified WASHING with chosen details, finished and verified bay AVAILABLE again. Test-only session/history retained. Screenshot ../opsvision-start-options.jpg. Strict typecheck and lint passed; prior backend integration unchanged.


2026-10-19: User re-enabled AI video work. Added rotated camera/bay analysis, visual region calibration, stable entry/exit observations, partial-duration protection,128MiB/30min support, private progress and restart cache; preserved human review rather than fabricated fine categories/services. Removed vehicle-size selectors everywhere, keeping historical pricing compatibility.


2026-10-19 FINAL measured video result: complete cold pass finished315.44s, source966s,193frames at0.199703fps,7raw tracks; zone-summary0entries/0exits/0complete passages/2partial visits. Main zone tracksV0027.233–195.45 andV004211.05–961.233; visually same primary white SUV fragmented by tracking gap, NOT2confirmed vehicles or washes. Other5raw tracks outside selected zone are hidden by default behind explicit show-outside checkbox. Raw model fine-category/service/duration remainUNKNOWN; visible exterior washing is a human visual observation only. Imported into authorized demo org/bay1 via scripts/import-analyzed-video.ts, job22eabc7f-a0a5-449f-9565-43882374619a, source/evidence private and normal completion event audited; no operational washes/payments created. Actual9recording HTTP checks PASS (owner/private ranges/worker and unauth denials), plus19generalHTTP PASS after restart under network grant.62integration/19unit/13Python/lint/typecheck/build PASS before final small show-outside toggle; final lint/typecheck outcome below. Browser verified owner wash form no size and local file preview, rotation270, frame150s, actual drag region; screenshot ../opsvision-ai-zone-preview.jpg. Actual report displayed in UI with branch/bay and correct partial times. Fresh reload needed after translation HMR; do not ignore missing-message overlay if present. Worker75403 running continuously in current execution context, dev73215 and DB12635; supervision/persistence beyond tool context not claimed. New runtime .data/vision-runtime-current installed successfully after setting TEMP/TMP .data/tmp-vision; no ACL changes. Initial .5fps interrupted run had no report; actual finished pass is .2fps and limitations documented. Arabic result ../video-analysis-whatsapp/نتيجة-التجربة.md. Live camera ingestion, reliable fine-body/wash-service classifier and full-cycle accuracy validation remain pending; not a complete autonomous AI system.
2026-10-21: Added the branded Arabic camera-IP setup PDF at `public/guides/opsvision-camera-ip-guide-ar.pdf` and view/download links in both platform wash management and the tenant camera-IP screen. Platform administrators and tenant managers with camera-management permission can already save a camera IP per bay. Saving remains metadata only; live connection is not implied.
2026-10-23: Prepared a shared-Droplet deployment with a dedicated Compose project, private loopback port 3100, external HTTPS origin validation, Nginx host template and deployment guide. Audited source comments; no Arabic comments found. No server changes or deployment were performed.
