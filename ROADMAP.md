# ROADMAP — AnyPay

How to use this file: see CLAUDE.md → Workflow. Status values: Not started · In progress · Done.
Brief, numbers, judging weights and submission rules: [docs/challenge.md](docs/challenge.md).

## Key dates
- Build period: 5 Oct – 5 Nov 2026 (feature freeze 2 Nov)
- Submission: post the shared folder link in our team's Slack channel; confirm the exact deadline there
- Judging: 6 – 20 Nov · Grand Finale (top 5, in person, Cape Town): 21 Nov

## Phase 0 — Scaffold · target 6 Oct · Status: Done
- [x] npm workspaces monorepo: apps/web, apps/api, packages/shared
- [x] apps/web: Vite + React + TS PWA, Tailwind v4, shadcn/ui init, light/dark tokens + toggle, app shell with floating tab bar; routes / (onboarding), /shop/:id/pay, /merchant, /tab, /settings
- [x] apps/api: Express 5 + TS, composition root, class skeletons, zod env validation, GET /health
- [x] packages/shared: money utils + zod schemas with Vitest tests
- [x] ESLint, Prettier, .editorconfig
- [x] .gitattributes (LF), .gitignore (.env, *.key, dist, node_modules)
- [x] GitHub Actions CI (lint/test/build), sonar-project.properties, .env.example, README quick start
- [x] docs/design/refs/ is missing from the repo: add the 4 chosen refs from the kickoff images
- [x] i18next set up now so shell strings don't need retrofitting
- [x] docs/decisions.md with Phase 0 decisions
- [x] Follow-up: GitGuardian false positive (fake key in a test) replaced with a value generated at runtime
- [x] Follow-up: SonarCloud first scan fixed (91 issues: stubs, read-only props, `<output>`, pinned actions, `npm ci --ignore-scripts`, vendored CSS excluded); `.sonarcloud.properties` for Automatic Analysis; Dependabot
- [x] Follow-up: Sepedi, isiXhosa and isiZulu (drafts) with a language picker (starts in English, remembers the choice); locales lazy-loaded and key parity tested
- [x] Follow-up: landing layout reworked (header aligned, illustration fills the middle, actions stay above the fold in every language, dark browser chrome on iOS)

Scope: no payment logic yet.

**Done when**
- [x] `npm install` and `npm run dev` start web and API on Windows
- [x] GET /health returns 200; the shell renders in both themes and installs as a PWA
- [x] Lint, test and build pass locally and in CI (green on Ubuntu + Windows for `main` after PR #1)

**Team:** import the repo into SonarCloud (done, Automatic Analysis). Mark GitGuardian incident 37897618 as a false positive (test value, never a real secret).

## Phase 1 — Prove Open Payments works (no UI) · target 11 Oct · Status: Done
- [x] Read the SDK types and openpayments.dev first (SDK 7.4.0 types, interaction hash spec, Rafiki outgoing-payment errors)
- [x] OpenPaymentsGateway, WalletAddressResolver, GrantService, PaymentOrchestrator (CLAUDE.md steps 1–5)
- [x] Private key from env (base64) or a gitignored file; never logged
- [x] `npm run demo:pay -- --from <wallet> --to <wallet> --amount 25.00`: logs each step, waits while I approve consent in the browser
- [x] Clear errors for declined consent, expired quote and insufficient funds
- [x] Orchestrator unit tests with a mocked gateway
- [x] WalletAddressResolver SSRF tests: http, IP literals, localhost, private ranges, hosts off the allowlist
- [x] Allowlist matches subdomains: the test wallet's auth server is `auth.interledger-test.dev`, not `ilp.`; also check the auth/resource server URLs a wallet address returns
- [x] Interaction `hash` verification (SHA-256 base64 of client nonce, AS nonce, interact_ref, grant URL; padding-tolerant, constant-time) with tests
- [x] Insufficient funds surfaces after creation (payment `failed`, nothing sent), so the watcher polls the outgoing payment
- [x] Confirm the insufficient-funds behaviour live: moved to docs/testing.md (manual check, not blocking)
- [x] Live check up to consent against the test wallet: payment request, ZAR→COP quote and consent grant (with the 127.0.0.1 callback) all accepted
- [x] Fix: uuid advisory via override; lockfile regenerated cleanly after a half-edited one broke request signing

**Done when**
- [x] A real test-wallet payment completes and both balances change (2026-10-09: R 0,13 ZAR → COP 25,00, approved in the customer wallet, shop received it)
- [x] Each error case has a test and a clear message

**Team:** test wallet with 3 addresses (done: merchanttest = shop, southtest = customer, 889920ca = AnyPay app), developer key for the app wallet (done, in local .env), play money (done). Approve one real payment with `npm run demo:pay -- --amount 25.00` to tick the first Done-when box. Join the Interledger Community Slack support channel for technical questions.

**Note:** the shop wallet is in COP and the customer in ZAR, so the demo shows a cross-currency quote. For a South African spaza story, consider a ZAR shop wallet for the main demo and keep COP to show FX.

## Phase 2 — Features 1–3 · target 18 Oct · Status: Done
Plan (2026-10-09): Postgres via Drizzle (PGlite locally, Neon in production; hand-written SQL migrations), encrypted payment sessions, merchant token for the feed, SSE for live updates, then the web screens. Test checklist: [docs/testing.md](docs/testing.md).

- [x] Merchant onboarding + printable A5 QR poster
- [x] Customer pay flow: keypad → quote sheet → consent redirect → receipt
- [x] Merchant live feed: SSE, voice confirm, aria-live, daily totals, CSV export
- [x] Empty, loading, offline, error and success states on every screen
- [x] Postgres via Drizzle: shops, payments, idempotency records; migrations (PGlite locally with zero setup, Neon/Supabase in production)
- [x] Grant tokens encrypted at rest (AES-256-GCM, TOKEN_ENCRYPTION_KEY); the customer wallet stays inside the encrypted session
- [x] Merchant token protects the live feed and CSV (shop ids are public on the poster)
- [x] Grant callback route: verify `hash`, single-use nonce, then continue the grant
- [x] `Idempotency-Key` required on every money-moving endpoint (duplicates return the original result); rate limits on payment routes
- [x] Motion (LazyMotion + `m`) spring animations for bottom sheets and the success tick; honour reduced motion
- [x] Seed script (demo merchant + customer) and DEMO_MODE banner
- [x] Dropped drizzle-kit (old esbuild advisory) for hand-written SQL migrations; audit fix for concurrently → shell-quote (critical)
- [x] Deploy web + API; URLs in the README: <https://anypay-web.onrender.com> on Render + Neon (2026-10-14). The API stays on Render's free plan by team decision: it sleeps after 15 idle minutes, so open `/health` a few minutes before a demo
- [x] Short links: `/start` (set up a shop), `/s/<code>` (pay; the poster's QR uses it, so it is smaller), `/shop/<code>`; the API's own address redirects to the app
- [x] The phone remembers what it can: a shop's profile (the pay screen opens at once, even with no signal) and today's feed (shown before the live connection is up)
- [x] Navigation (team testing on phones, 2026-10-14): Back on every screen without the tab bar (installed iPhone apps have no browser Back), with a sensible fallback when opened from a QR code or link; start page offers **Open <shop>** and the installed app opens into the feed; set-up asks before replacing the phone's shop; **I'm a customer** opens a new **Pay a shop** page (camera + shop code); receipt has **Done**; Back from the wallet no longer leaves the price sheet frozen
- [x] Shop codes are 8 characters from 31 unambiguous ones in one case (printed on the poster, typed in any case)
- [x] Security pass: rate limit on every API route plus caps on open live feeds; wallet approval links must be https (server and app); Content-Security-Policy built into the page (no inline scripts) and a Permissions-Policy header; shop names refuse hidden/bidi characters; amounts capped below one billion; shop codes checked before any database lookup; `npm audit` clean
- [x] The API warns at startup when phones on Wi-Fi couldn't come back from the wallet (`PUBLIC_API_URL` still localhost)
- [x] Route focus waits for pages that render their heading after loading data (pay, receipt); focus returns to Continue when the price sheet closes
- [x] Quote sheet loads on Continue (pay page first load 206 → 186 KB); size report measures each page's real first load from Vite's manifest (heaviest page 189.5 KB, shell 181.3 KB)
- [x] Live feed reconnects after the browser gives up (API restart, sleeping host) and signs out when the shop is gone (401/404); indicator is a status region
- [x] Local database lock: two dev APIs on one `.data/pglite` corrupted it (2026-10-09). A second API now stops with a clear message; shutdown closes live connections so the database closes cleanly
- [x] `DATA_DIR` accepts absolute paths; `npm run seed -- --api … --web …` for the deployed app; `npm run dev:lan` for phones on Wi-Fi
- [x] Wallet field asks only for the name after `$ilp.interledger-test.dev/` (team idea); pasting a full address works, and one tap switches to any other provider
- [x] Deploy guards: the web build fails when `VITE_API_URL`'s host doesn't exist (the first deploy shipped `https://anypay-api.onrender`, no `.com`), and the API warns at startup when `PUBLIC_API_URL` doesn't reach it
- [x] Idempotency records are encrypted (they kept new shops' merchant tokens in plain text), old ones cleared by migration 0002, and records older than a day purged at startup
- [x] Dependabot's TypeScript 7 bump broke `npm ci` (typescript-eslint supports < 6.1): back to 6.0, TypeScript minor/major updates ignored until it does
- [x] Component tests (Testing Library + happy-dom) for the new screens: SonarCloud's default gate wants 80% coverage on new code. Page tests use a scripted API and a fake EventSource; overall coverage 55% → 82%, new pages and hooks 87–98%
- [x] New strings translated in all four locales (drafts are fine until the native-speaker review)

**Done when**
- [x] On the deployed URLs, a payment from one phone appears and is announced on another within seconds
- [x] First load ≤ 200 KB gzipped (number reported): heaviest page 189.5 KB, app shell 181.3 KB (2026-10-09)

**Team:** hosting accounts and production env vars. Book the optional mid-project mentor check-in.

## Phase 3 — Offline Digital Tab · target 25 Oct · Status: Done
- [x] Tab opening: interval-capped outgoing-payment grant + device key registration (the test wallet accepts the weekly limit, 2026-10-15)
- [x] Two-QR voucher exchange
- [x] Dexie outbox + SyncManager with per-item sync states
- [x] Server verification + settlement
- [x] Rotate expired tab grant tokens (`token.rotate`); stored tokens encrypted at rest
- [x] Tests: valid voucher, tampered amount, reused nonce, cap exceeded, idempotent re-sync from both phones
- [x] DEMO_MODE "Simulate offline" toggle
- [x] In-app QR scanner (qr-scanner, lazy-loaded): vouchers need it, and "Pay a shop" can use it too (installed apps can't hand off to the camera app)
- [x] Budget: Dexie (30 KB) and the scanner (16 KB) load lazily, so every first load stays under 200 KB (heaviest 195.6 KB). Headroom is now 4.4 KB: `zod/mini` moves to Phase 4
- [x] SonarCloud security rating C on `main`: the seed script's `--api` could send requests anywhere (S8703); now `--target local|deployed`

**Done when**
- [x] Two phones in airplane mode complete a sale, and after reconnecting it settles exactly once

**Team:** usability test with 2–3 spaza owners; note what changed.

## Phase 4 — Polish & submission · target 1 Nov (freeze 2 Nov) · Status: In progress
- [x] Fix axe/Lighthouse issues, contrast in both themes, 200% text, reduced motion, i18n coverage, bundle budget, Sonar issues (24 minor code smells on main, 2026-10-15)
  - [x] Lighthouse mobile on the production build (median of 3, 2026-10-15): start 93, Pay a shop 94, pay screen 92, set-up 94; accessibility, best practices and SEO 100 on all four (robots.txt, zod CSP probe, shop prefetch, launch mark, Motion only on the receipt)
  - [x] Sonar: all 37 open issues on main fixed or marked with the reason (2026-10-16)
  - [x] 200% text: nine screens at phone width (375 px), none overflow or push text off-screen, with a long shop name (2026-10-16)
  - [x] Reduced motion: the global CSS reset plus Motion's reducedMotion="user"; page tests run with reduce-motion on. Still to try on a real phone (docs/testing.md)
- [x] Web zod to `zod/mini` (or validate less in the browser): first-load headroom is 4.4 KB (now 18.5 KB: shared schemas are zod/mini, 24 → 8 KB gz)
- [x] Native-speaker review of Sepedi, isiXhosa and isiZulu (see apps/web/src/i18n/README.md)
- [x] Test on a budget Android phone outdoors in sunlight, and on an iPhone
- [x] README: setup, steps for judges, demo accounts (test money only), Mermaid architecture + sequence diagrams, known limitations, next steps, acknowledgements (libraries and AI tools, including Claude Code)
- [x] Summarise docs/decisions.md into slide-ready bullets: docs/slides.md (team slots marked for interview quotes and the usability-test change)
- [x] Receipt says "not found" when the API is down behind a proxy (502); tell "can't reach AnyPay" apart from a missing receipt
- [x] Privacy notice page (what is stored: shop name, wallet address, amounts; customer wallets only encrypted) and how long payments are kept (POPIA): `/privacy`, linked from the start page and Settings
- [x] Team: confirm the Neon project is in Europe (the privacy page says servers and database are in Europe)
- [x] Retention: payments are kept until the demo is reset; a real launch needs a schedule that deletes or anonymises old payments (then update the privacy page)
- [x] "Use this shop on another phone" (show the sign-in link as a QR) and "sign out other phones" (rotate the merchant token): Settings → Use on another phone; the phone picks its new token, so a lost answer never locks it out, and open feeds on other phones end at once
- [x] Merchant feed token travels as `?token=` (EventSource can't send headers): consider a short-lived stream ticket. Now a one-minute ticket bought with the token in a header; "sign out other phones" revokes tickets
- [x] Error handling for real phones and networks (2026-10-16):
  - request timeouts with "Still working…", and the host's 502 read as "waking up"
  - reload once after a deploy
  - the phone's clock corrected for vouchers
  - offline tabs explain plain http:// and blocked or full storage; persistent storage requested
  - keep the screen on
  - the API logs unhandled rejections; Neon idle connections handled
  - fixed CORS for PUT (sign out other phones would have failed in production), a "No tabs yet" flash during refresh, and a retry loop in sign-out recovery
- [x] Team decision: add Afrikaans? The third most common home language (10.6%, Census 2022) isn't offered yet (docs/research/desk-research.md). Added as a fifth language (draft, needs a native speaker's review); the five cover about 70% of home languages
- [x] Consider precaching only the customer's screens on a customer's phone: today a first visit fetches the whole app (about 330 KB, about 5c of data) for offline use. Now 231 KB; the shop's and tab screens are cached on first use, and phones that run a shop or a tab fetch theirs once in the background
- [x] CI on main failed after the Dependabot merges (lockfile out of sync; happy-dom 21 installed where Vitest can't see it): lockfile repaired, happy-dom moved to the root
- [x] Tabs "stuck" on the weekly limit (2026-10-24):
  - the wallet's own refusal (fees and exchange used the limit) now marks the week full, so both phones stop taking sales that would only fail, and show when it resets
  - a voucher whose settlement couldn't start (wallet network down) is given back and retried, instead of lost
  - the customer sells on the tab with room when an old one is used up
  - the approve screen shows roughly what leaves their wallet in their own currency, and refuses an over-limit sale before the tap, with the reset date and a way to a higher limit
  - clearer failure reasons with what to do next
  - an end-to-end test of the whole tab journey on two phones
- [ ] First-load budget is tight after the library updates: heaviest page (receipt) 198.8 of 200 KB after Dependabot #12. Check before adding anything to the app shell

**Done when**
- [x] Lighthouse mobile Performance and Accessibility ≥ 90; Sonar quality gate passes (production build: performance 92–94, accessibility 100 on four pages, 2026-10-15; gate OK on main and PR #8)
- [x] A teammate follows the README on a clean machine and runs the demo

**Team:** slides, 10–15 min video, submission folder.

## Research & design track (team, alongside the phases)
Worth 40% of the marks (problem understanding + design process). Keep notes in docs/challenge.md or docs/research/.
- [ ] Interview 3–5 spaza owners, with consent: how customers pay, card/QR costs, credit for regulars, data costs and signal, what makes them trust a payment. Kit: docs/research/interview-guide.md (consent script, questions, write-up template)
- [x] Problem statement and key stats with sources (started in docs/challenge.md): docs/research/desk-research.md, 19 sources, each finding mapped to what AnyPay does; check a source before its number goes on a slide
- [ ] Personas: one merchant, one customer (from the interviews; the assumptions to test are in the interview guide)
- [ ] User journeys and user flows for Features 1–4: flows as built are in docs/research/flows.md; journeys with pain points come from the interviews
- [ ] Wireframes, and each design change logged with its reason in docs/decisions.md
- [x] Information architecture and system architecture diagrams: screen map in docs/research/flows.md, architecture and sequence diagrams in the README
- [ ] Usability test with 2–3 owners (Phase 3) and what changed as a result. Kit: docs/research/usability-test.md (seven tasks, measures, findings → changes)

## Submission checklist (by 5 Nov; confirm the deadline in Slack)
- [ ] Presentation (PDF or PowerPoint): problem and opportunity, research insights, user stories/journeys, user flows and architecture diagrams, design decisions and process, tech implementation and stack, key features, challenges and how we overcame them, impact and future improvements
- [ ] 10–15 minute recorded walkthrough with the live demo (airplane-mode moment)
- [ ] Live demo link and public repo link, both opened in an incognito window
- [ ] Shared cloud folder with everything clearly labelled, open to anyone with the link
- [ ] Folder link posted in the team's Slack channel before the deadline
- [ ] Known limitations and next steps stated; AI tools (Claude Code) and libraries acknowledged

## Stretch (only after Phase 4 is Done)
- [ ] Stokvel group pot (recurring grants)
- [ ] Cross-currency "send home"

## Progress log
<!-- One entry per session: YYYY-MM-DD · done · next · blockers -->
- 2026-10-05 · Phase 0 scaffold built on `phase-0-scaffold`: shared money utils + zod schemas, Express 5 API (env validation, /health, security middleware, service skeletons), React PWA shell (tokens, light/dark toggle, floating tab bar, 5 lazy routes, i18n, offline banner, update prompt), CI + Sonar config, docs. 155 tests; lint, typecheck and build pass; first load 138.8 KB gz of 200 KB. · Next: push, confirm CI is green on Ubuntu + Windows, mark Phase 0 Done, then Phase 1 (Open Payments, no UI). · Blockers: SonarCloud needs Automatic Analysis turned off and a `SONAR_TOKEN` repo secret (the CI job skips until then); second language still to choose.
- 2026-10-05 · PR #1 merged; CI green on Ubuntu + Windows, Phase 0 Done. Follow-ups on `phase-0-polish`: GitGuardian false positive removed, 91 SonarCloud findings fixed or scoped out, Sepedi/isiXhosa/isiZulu drafts + language picker, landing layout reworked, roadmap extended (key dates, research track, submission checklist), docs/challenge.md. · Next: merge `phase-0-polish`, then Phase 1 plan. · Blockers: Phase 1 needs the test wallet addresses and developer key in a local `.env`; translations need a native-speaker review.
- 2026-10-06 · Language now starts in English and remembers the choice. Pasted keys moved out of the committed .env.example into gitignored .env/.secrets (never committed or pushed). Phase 1 built: Open Payments gateway (only SDK importer), SSRF-safe wallet resolver, grant service with callback-hash verification, payment state machine, watcher, demo:pay CLI; 132 API tests (298 total). Live run reached consent against the real test wallet. · Next: approve one real payment (demo:pay), test insufficient funds live, then mark Phase 1 Done. · Blockers: needs a person to approve consent in the customer test wallet.
- 2026-10-09 · Phase 1 closed (real payment verified, R 0,13 → COP 25,00). Phase 2 on `phase-2-features`: Postgres via Drizzle (PGlite locally), encrypted payment sessions, idempotency, rate limits, shops/payments/callback/SSE/CSV routes; web screens for shop setup, A5 QR poster, live feed with voice, pay flow with keypad and quote sheet, receipt. Checked in the browser against the real test wallet up to consent, plus decline, seed link and a production-style cross-origin run. Fixed on the way: route focus, sheet focus, quote sheet lazy-loaded (budget), feed reconnects, PGlite corruption from two dev APIs (now locked). 414 tests; lint, typecheck and build pass; heaviest first load 189.5 KB. Tested by the team: real approval announced by voice, decline, CSV, languages, dark mode, poster print. · Next: phone-over-Wi-Fi and the remaining checks in docs/testing.md; create Render + Neon accounts and deploy with render.yaml (docs/deploy.md); then the Done-when two-phone check closes Phase 2. · Blockers: hosting accounts; a Neon password was pasted into render.yaml (removed before any commit, never pushed): rotate it in Neon to be safe and paste the new one only into Render.
- 2026-10-14 · Team tested on phones and on Render: the deployed two-phone payment works (Phase 2 "Done when" ticked). Fixed what testing found: navigation dead ends and the Back button (incl. installed iPhone app), accidental shop replacement, no customer start page, frozen price sheet after Back from the wallet. Security pass: rate limits everywhere, live-feed caps, https-only approval links, CSP and Permissions-Policy, stricter names/amounts, readable shop codes; `npm audit` clean. Local `.env` pointed at the production database (flagged; see .env.example). · Next: merge `phase-2-hardening`, Manual sync the Blueprint, test the new checklist section, decide on a paid API instance, then close Phase 2 and plan Phase 3. · Blockers: none in code; the paid-tier decision is the team's.
- 2026-10-14 · Phase 2 closed: hardening merged and live (headers checked on Render), deploy item done by team decision (free API plan), short links + API root redirect, shop profile and today's feed cached on the phone. · Next: Phase 3 (Offline Digital Tab). · Blockers: none.
- 2026-10-14 · Phase 3 server done on `phase-3-offline-tab` (47e4a89): shared voucher protocol (P-256 sign/verify, links), tabs with weekly-capped grants, cap measured in shop currency (verified live), vouchers claimed by nonce and settled once with the stored grant, token rotation, routes and 11 flow tests. · Next: web side: Dexie outbox + SyncManager, device keys, open-tab / my tabs / approve-sale (/t/) / receive-voucher (/v/) screens, merchant tab-sale screen, in-app QR scanner, Simulate offline toggle, i18n x4. · Blockers: none.
- 2026-10-15 · SonarCloud security C fixed (seed script SSRF) on `phase-2-wrap-up`, merged into Phase 3. Phase 3 web side built on `phase-3-offline-tab`: Dexie offline store (lazy), outbox SyncManager, Simulate offline, open tab / my tabs / tab detail / approve sale / tab sale / receive voucher / in-app scanner, feed integration, four languages. Real test wallet accepts the weekly-limit grant; device key stored non-extractable. 554+ tests; budget 195.6 KB. · Next: you push `phase-2-wrap-up` (Sonar, /start live), then test Phase 3 with two phones (docs/testing.md) for its "Done when"; then Phase 4. · Blockers: the wallet approval and two real phones are the team's.
- 2026-10-15 · Phase 3 closed (two-phone airplane-mode sale settled once, tested by the team). Phase 4 on `phase-4-polish`: Lighthouse mobile ≥ 90 on the four main pages (92–94; a11y, best practices, SEO 100) via shop prefetch, launch mark, zod/mini (24 → 8 KB), Motion only on the receipt and robots.txt; CSP issue fixed (zod's eval probe); receipt tells "can't reach AnyPay" from "not found"; privacy page (POPIA); "Use on another phone" QR and "Sign out other phones" (token rotation that can't lock a shop out, open feeds ended). 593 tests; heaviest first load 191.5 KB. · Next: stream ticket instead of `?token=`, Sonar smells, 200% text / reduced-motion pass, slide bullets; team: native-speaker review, budget-phone and iPhone test, confirm the Neon region, the Phase 4 checklist in docs/testing.md. · Blockers: none.
- 2026-10-16 · Phase 4 on `phase-4-finish` (from main after PR #8). Error handling for real phones and networks (timeouts and "Still working…", host 502 as "waking up", reload after deploy, phone clock correction for vouchers, offline-tab explanations, persistent storage, keep the screen on, API unhandled rejections, Neon idle connections); found and fixed: CORS blocked PUT (sign out other phones in production), "No tabs yet" flash during refresh, a sign-out recovery loop. All 37 Sonar issues on main addressed. Live feed opens with one-minute tickets. 200% text checked on nine screens. Desk research (19 sources) mapped to the solution, interview and usability-test kits, screen map and flows, slide bullets. 619 tests; heaviest first load 193.3 KB. · Next: team runs interviews and the usability test with the kits, native-speaker review, phone checks in docs/testing.md (incl. the new "real phones, bad networks" section), decides on Afrikaans; a teammate follows the README on a clean machine (last Phase 4 "Done when"). · Blockers: none in code.
- 2026-10-24 · On `phase-4-next` (from main; your roadmap ticks carried over). CI fixed: the Dependabot merges had left the lockfile out of sync and happy-dom 21 where Vitest can't find it. Tabs no longer get stuck on the weekly limit (the wallet's refusal closes the week on both phones, with the reset date; vouchers survive a wallet-network outage; the tab with room is used; own-currency estimate; over-limit refused up front; clearer reasons; whole two-phone journey tested). Afrikaans added (fifth language, draft). Customers precache 231 KB instead of 340 KB. Three SonarCloud issues fixed. 637 tests; heaviest first load 198.0 KB. · Next: you push and open the PR; phone checks in docs/testing.md ("The tab under real use"); native-speaker review incl. Afrikaans; logo and home button next round. · Blockers: none.
