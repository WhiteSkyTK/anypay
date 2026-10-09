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

## Phase 2 — Features 1–3 · target 18 Oct · Status: In progress
Plan (2026-10-09): Postgres via Drizzle (PGlite locally, Neon in production; hand-written SQL migrations), encrypted payment sessions, merchant token for the feed, SSE for live updates, then the web screens. Test checklist: [docs/testing.md](docs/testing.md).

- [ ] Merchant onboarding + printable A5 QR poster
- [ ] Customer pay flow: keypad → quote sheet → consent redirect → receipt
- [ ] Merchant live feed: SSE, voice confirm, aria-live, daily totals, CSV export
- [ ] Empty, loading, offline, error and success states on every screen
- [ ] Postgres via Drizzle: shops, payments, idempotency records; migrations (PGlite locally with zero setup, Neon/Supabase in production)
- [ ] Grant tokens encrypted at rest (AES-256-GCM, TOKEN_ENCRYPTION_KEY); the customer wallet stays inside the encrypted session
- [ ] Merchant token protects the live feed and CSV (shop ids are public on the poster)
- [ ] Grant callback route: verify `hash`, single-use nonce, then continue the grant
- [ ] `Idempotency-Key` required on every money-moving endpoint (duplicates return the original result); rate limits on payment routes
- [ ] Motion (LazyMotion + `m`) spring animations for bottom sheets and the success tick; honour reduced motion
- [ ] Seed script (demo merchant + customer) and DEMO_MODE banner
- [ ] Dropped drizzle-kit (old esbuild advisory) for hand-written SQL migrations; audit fix for concurrently → shell-quote (critical)
- [ ] Deploy web + API on tiers that don't sleep; URLs in the README
- [ ] Component tests (Testing Library + happy-dom) for the new screens: SonarCloud's default gate wants 80% coverage on new code, and React components have none yet
- [ ] New strings translated in all four locales (drafts are fine until the native-speaker review)

**Done when**
- [ ] On the deployed URLs, a payment from one phone appears and is announced on another within seconds
- [ ] First load ≤ 200 KB gzipped (number reported)

**Team:** hosting accounts and production env vars. Book the optional mid-project mentor check-in.

## Phase 3 — Offline Digital Tab · target 25 Oct · Status: Not started
- [ ] Tab opening: interval-capped outgoing-payment grant + device key registration
- [ ] Two-QR voucher exchange
- [ ] Dexie outbox + SyncManager with per-item sync states
- [ ] Server verification + settlement
- [ ] Rotate expired tab grant tokens (`token.rotate`); stored tokens encrypted at rest
- [ ] Tests: valid voucher, tampered amount, reused nonce, cap exceeded, idempotent re-sync from both phones
- [ ] DEMO_MODE "Simulate offline" toggle

**Done when**
- [ ] Two phones in airplane mode complete a sale, and after reconnecting it settles exactly once

**Team:** usability test with 2–3 spaza owners; note what changed.

## Phase 4 — Polish & submission · target 1 Nov (freeze 2 Nov) · Status: Not started
- [ ] Fix axe/Lighthouse issues, contrast in both themes, 200% text, reduced motion, i18n coverage, bundle budget, Sonar issues
- [ ] Native-speaker review of Sepedi, isiXhosa and isiZulu (see apps/web/src/i18n/README.md)
- [ ] Test on a budget Android phone outdoors in sunlight, and on an iPhone
- [ ] README: setup, steps for judges, demo accounts (test money only), Mermaid architecture + sequence diagrams, known limitations, next steps, acknowledgements (libraries and AI tools, including Claude Code)
- [ ] Summarise docs/decisions.md into slide-ready bullets

**Done when**
- [ ] Lighthouse mobile Performance and Accessibility ≥ 90; Sonar quality gate passes
- [ ] A teammate follows the README on a clean machine and runs the demo

**Team:** slides, 10–15 min video, submission folder.

## Research & design track (team, alongside the phases)
Worth 40% of the marks (problem understanding + design process). Keep notes in docs/challenge.md or docs/research/.
- [ ] Interview 3–5 spaza owners, with consent: how customers pay, card/QR costs, credit for regulars, data costs and signal, what makes them trust a payment
- [ ] Problem statement and key stats with sources (started in docs/challenge.md)
- [ ] Personas: one merchant, one customer
- [ ] User journeys and user flows for Features 1–4
- [ ] Wireframes, and each design change logged with its reason in docs/decisions.md
- [ ] Information architecture and system architecture diagrams
- [ ] Usability test with 2–3 owners (Phase 3) and what changed as a result

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
