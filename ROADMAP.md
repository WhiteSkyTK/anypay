# ROADMAP — AnyPay

How to use this file: see CLAUDE.md → Workflow. Status values: Not started · In progress · Done.

## Phase 0 — Scaffold · target 6 Oct · Status: Not started
- [ ] npm workspaces monorepo: apps/web, apps/api, packages/shared
- [ ] apps/web: Vite + React + TS PWA, Tailwind v4, shadcn/ui init, light/dark tokens + toggle, app shell with floating tab bar; routes / (onboarding), /shop/:id/pay, /merchant, /tab, /settings
- [ ] apps/api: Express 5 + TS, composition root, class skeletons, zod env validation, GET /health
- [ ] packages/shared: money utils + zod schemas with Vitest tests
- [ ] ESLint, Prettier, .editorconfig, .gitattributes (LF), .gitignore (.env, *.key, dist, node_modules)
- [ ] GitHub Actions CI (lint/test/build), sonar-project.properties, .env.example, README quick start

Scope: no payment logic yet.

**Done when**
- [ ] `npm install` and `npm run dev` start web and API on Windows
- [ ] GET /health returns 200; the shell renders in both themes and installs as a PWA
- [ ] Lint, test and build pass locally and in CI

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