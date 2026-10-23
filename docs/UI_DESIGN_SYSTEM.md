# UI design system

Brand: OpsVision typographic wordmark in Inter, bold Ops and lighter rose Vision. Text-only component src/components/logo.tsx. No SVG assets, pictograms, emoji or ornamental shapes. Icon-only controls replaced with localized visible labels. Functional activation QR remains PNG.

User correction: original off-white #F7FAF8 background stays throughout. Small pink #F8DCE5 accents on homepage registration button/banner. Teal #3F7773 primary workspace actions, dark #243D3B text/navigation, yellow #FFF6B8 selected states and white cards.

Arabic default/RTL, English/LTR, locally bundled Cairo/Inter. Plain everyday wording; no slogans. Homepage product illustration, features section and numbered steps removed at user request. Footer only contains the wordmark on all public pages.

Maintain functional UI: labels/focus styling, accessible status text, native dialogs, responsive navigation, receipts and QR. Do not reintroduce decorative icons or a pink page background.

Latest image placement correction: remove photograph from homepage. Use public/assets/car-wash-hero.png only behind the login page with CSS blur and a light overlay; the login card stays sharp. Main homepage retains original off-white with small pink accents. Sidebar remains white/pink selection. Earlier homepage-photo screenshots are historical.


User-requested audit and integration-status navigation removed. Organization settings remain a simple form. Added global bay cards/search, service template choices and minimal customer tracking page/functional QR dialog; no decorative icons/SVG/emoji introduced. Latest visual QA blocked by browser URL policy; build/API behavior verified.


2026-10-19: User requested light blue instead of green specifically on login and a car/car-wash mark beside OpsVision. Login-only CSS variables/buttons/links/focus changed to blue with dark readable text; optional CSS-drawn car/water mark enabled for login header/footer only (no SVG/emoji). This explicit request supersedes the older text-only logo preference for login. Existing blurred photo and all other page colors preserved. Browser verified actual blue button and car wordmark; lint/typecheck results in TESTING.md.


2026-10-19 logo correction: user rejected CSS car icon and requested a realistic car integrated with OpsVision. Generated transparent integrated automotive wordmark with built-in image_gen; copied unchanged to public/assets/opsvision-car-logo.png and enabled through existing login car prop for header/footer. Removed CSS car drawing. Login blue styling and blurred photo preserved; other logos remain typographic. Prompt/provenance: LOGO_PROMPT.md. Actual login header inspected in-browser and screenshot ../opsvision-login-realistic-logo.jpg saved.


2026-10-19 final brand: user selected black Ops, blue Vision with V-to-car roof connection and redesigned black/white car, then requested it system-wide. Approved asset public/assets/opsvision-car-logo-connected.png now shared by every Logo instance: public pages, login, sidebar, receipts, customer tracking and footers. Compact 180/160px header and170px sidebar/footer. Square generated app asset1254x1254 added to manifests/favicon/Apple metadata, unchanged copies; generator no longer recreates old typography. Details and exact built-in imagegen prompts in BRAND_ASSETS.md. Actual homepage header inspected successfully. Earlier logo directions are superseded; no extra page palette changes.


Current override: green UI tones are replaced globally by light blue; buttons #B9DCF7 with #244D70 labels, dark text #263F55, neutral background #F7F9FC. Quiet pink remains. Organization groups border2px/radius18px, alternating #FCF0F5/pink border and #EDF6FD/blue border; inner bay cards white and every organization occupies its own full-width row. Alternation tied to organization order before filtering.


Vehicle size controls removed from every visible form/table. Analysis now offers bay, orientation, sampling and optional recording start; calibrated region can be dragged on a local-video canvas, with numeric keyboard fallback. Canvas rectangle is a functional selection tool, not decorative geometry. Local preview blob URL never leaves browser until explicit upload.
