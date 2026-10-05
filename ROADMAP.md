# ROADMAP — AnyPay

How to use this file: see CLAUDE.md → Workflow. Status values: Not started · In progress · Done.

## Phase 0 — Scaffold · target 6 Oct · Status: In progress
- [x] npm workspaces monorepo: apps/web, apps/api, packages/shared
- [x] apps/web: Vite + React + TS PWA, Tailwind v4, shadcn/ui init, light/dark tokens + toggle, app shell with floating tab bar; routes / (onboarding), /shop/:id/pay, /merchant, /tab, /settings
- [x] apps/api: Express 5 + TS, composition root, class skeletons, zod env validation, GET /health
- [x] packages/shared: money utils + zod schemas with Vitest tests
- [x] ESLint, Prettier, .editorconfig
- [x] .gitattributes (LF), .gitignore (.env, *.key, dist, node_modules)
- [x] GitHub Actions CI (lint/test/build), sonar-project.properties, .env.example, README quick start
- [x] docs/design/refs/ is missing from the repo: add the 4 chosen refs from the kickoff images
- [x] i18next set up now so shell strings don't need retrofitting (English only for now)
- [x] docs/decisions.md with Phase 0 decisions

Scope: no payment logic yet.

**Done when**
- [x] `npm install` and `npm run dev` start web and API on Windows
- [x] GET /health returns 200; the shell renders in both themes and installs as a PWA
- [ ] Lint, test and build pass locally and in CI (local: passing; CI: runs after the branch is pushed)

**Team:** import the repo into SonarCloud.

## Phase 1 — Prove Open Payments works (no UI) · target 11 Oct · Status: Not started
- [ ] Read the SDK types and openpayments.dev first
- [ ] OpenPaymentsGateway, WalletAddressResolver, GrantService, PaymentOrchestrator (CLAUDE.md steps 1–5)
- [ ] Private key from env (base64) or a gitignored file; never logged
- [ ] `npm run demo:pay -- --from <wallet> --to <wallet> --amount 25.00`: logs each step, waits while I approve consent in the browser
- [ ] Clear errors for declined consent, expired quote and insufficient funds
- [ ] Orchestrator unit tests with a mocked gateway

**Done when**
- [ ] A real test-wallet payment completes and both balances change
- [ ] Each error case has a test and a clear message

**Team:** test wallet with 3 addresses (merchant, customer, app client), developer keys, play money.

## Phase 2 — Features 1–3 · target 18 Oct · Status: Not started
- [ ] Merchant onboarding + printable A5 QR poster
- [ ] Customer pay flow: keypad → quote sheet → consent redirect → receipt
- [ ] Merchant live feed: SSE, voice confirm, aria-live, daily totals, CSV export
- [ ] Empty, loading, offline, error and success states on every screen
- [ ] Deploy web + API on tiers that don't sleep; URLs in the README
- [ ] Component tests (Testing Library + happy-dom) for the new screens: SonarCloud's default gate wants 80% coverage on new code, and React components have none yet

**Done when**
- [ ] On the deployed URLs, a payment from one phone appears and is announced on another within seconds
- [ ] First load ≤ 200 KB gzipped (number reported)

**Team:** hosting accounts and production env vars.

## Phase 3 — Offline Digital Tab · target 25 Oct · Status: Not started
- [ ] Tab opening: interval-capped outgoing-payment grant + device key registration
- [ ] Two-QR voucher exchange
- [ ] Dexie outbox + SyncManager with per-item sync states
- [ ] Server verification + settlement
- [ ] Tests: valid voucher, tampered amount, reused nonce, cap exceeded, idempotent re-sync from both phones
- [ ] DEMO_MODE "Simulate offline" toggle

**Done when**
- [ ] Two phones in airplane mode complete a sale, and after reconnecting it settles exactly once

**Team:** usability test with 2–3 spaza owners; note what changed.

## Phase 4 — Polish & submission · target 1 Nov (freeze 2 Nov) · Status: Not started
- [ ] Fix axe/Lighthouse issues, contrast in both themes, 200% text, reduced motion, i18n coverage, bundle budget, Sonar issues
- [ ] README: setup, demo accounts (test money only), Mermaid architecture + sequence diagrams, known limitations, next steps, acknowledgements (libraries and AI tools, including Claude Code)
- [ ] Summarise docs/decisions.md into slide-ready bullets

**Done when**
- [ ] Lighthouse mobile Performance and Accessibility ≥ 90; Sonar quality gate passes
- [ ] A teammate follows the README on a clean machine and runs the demo

**Team:** slides, 10–15 min video, submission folder.

## Stretch (only after Phase 4 is Done)
- [ ] Stokvel group pot (recurring grants)
- [ ] Cross-currency "send home"

## Progress log
<!-- One entry per session: YYYY-MM-DD · done · next · blockers -->
- 2026-10-05 · Phase 0 scaffold built on `phase-0-scaffold`: shared money utils + zod schemas, Express 5 API (env validation, /health, security middleware, service skeletons), React PWA shell (tokens, light/dark toggle, floating tab bar, 5 lazy routes, i18n, offline banner, update prompt), CI + Sonar config, docs. 155 tests; lint, typecheck and build pass; first load 138.8 KB gz of 200 KB. · Next: push, confirm CI is green on Ubuntu + Windows, mark Phase 0 Done, then Phase 1 (Open Payments, no UI). · Blockers: SonarCloud needs Automatic Analysis turned off and a `SONAR_TOKEN` repo secret (the CI job skips until then); second language still to choose.