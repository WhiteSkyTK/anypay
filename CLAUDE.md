# CLAUDE.md — AnyPay
AnyPay: pay any spaza from any wallet, even offline.

## Context
Hackathon proof of concept (Cape Town Software Development Meetup × Interledger Foundation, build 5 Oct–5 Nov 2026).
Goal: let spaza shops take digital payments with no POS hardware, minimal data and tolerance for poor/no connectivity, using Open Payments (Interledger).
Judged on: problem understanding, solution design, meaningful Open Payments use, technical quality, UX/accessibility, impact, demo.
A focused feature that works beats a broad one that doesn't. Optimise for a reliable live demo.

## Workflow
- ROADMAP.md is the source of truth. At the start of each session, read it and work only on the first phase whose Status isn't Done.
- Starting a phase: create its branch (e.g. `phase-1-open-payments`), set Status to In progress, post a short plan and wait for my OK.
- As you go: tick items when finished; add newly discovered tasks under their phase instead of doing them silently.
- A phase is Done only when every "Done when" box is ticked and lint, test and build pass. Then stop and ask before starting the next phase.
- End of each session: append a Progress log entry (date · done · next · blockers) and commit. I push and open the PR.
- Team machines run Windows: npm scripts must be cross-platform (Node scripts or cross-env, no bash-only syntax); LF line endings via .gitattributes.
- The repo is public: never commit .env, *.key or credentials; check `git status` before every commit.

## Users
- Merchant: spaza owner, budget Android, prepaid data, often outdoors in sunlight, serving a queue fast, may prefer a local language.
- Customer: any phone with a browser and an Open Payments-enabled wallet from any provider (interoperability is the point).

## Features (strict priority; finish and demo each before starting the next)
1. Merchant onboarding (<2 min): wallet address → validate → shop profile → printable A5 QR poster.
2. Pay a shop (online): scan QR/open link → amount keypad → quote sheet (exact debit incl. FX/fees) → consent in own wallet → receipt.
3. Merchant live feed: payments appear in real time (SSE), voice confirm ("Payment received, R25"), daily totals, CSV export.
4. Offline Digital Tab: customer opens a tab at a shop once (online) by approving an outgoing-payment grant with a weekly cap. Afterwards sales are captured with both phones offline via signed QR vouchers and settle automatically when either phone reconnects.
5. Stretch only if 1–4 are solid: stokvel group pot (recurring grants), cross-currency "send home".

## Architecture
npm workspaces monorepo, TypeScript strict:
- apps/web: React + Vite PWA
- apps/api: Node 22 LTS + Express 5, OOP
- packages/shared: zod schemas, DTO types, money utils

### apps/web
React Router, Tailwind CSS v4, shadcn/ui, Motion (LazyMotion + `m`), lucide-react, Dexie, vite-plugin-pwa, qr-scanner + qrcode, i18next.
- Offline-first: app shell precached; every action writes to IndexedDB first, then syncs.
- Outbox: Dexie table; each item carries a client UUID (idempotency key). SyncManager flushes on `online`, on visibilitychange and with exponential backoff. Don't rely on the Background Sync API (not on iOS Safari).
- Per-item UI states: Saved offline → Sending → Settled | Failed (reason + retry).
- Logic lives in hooks (`usePaymentFlow`, `useOutbox`, `useOnlineStatus`, `useVoiceConfirm`); components stay presentational.

### apps/api
Single-responsibility classes, constructor injection, one composition root:
- `OpenPaymentsGateway`: the only module that imports `@interledger/open-payments`
- `WalletAddressResolver`: normalises `$host/name` → `https://host/name`; SSRF-safe
- `GrantService`: request / continue / rotate grants; tokens encrypted at rest (AES-256-GCM, key from env)
- `PaymentOrchestrator`: online flow as an explicit state machine
- `TabService`: tabs, device public keys, voucher verification, settlement
- `PaymentWatcher`: polls incoming payments until completed → events → SSE
- Repositories: Postgres (Neon/Supabase free tier) via Drizzle
Routers stay thin: zod → service → DTO. `Idempotency-Key` required on every endpoint that moves money; duplicates return the original result.

## Open Payments flow (exact)
Read the SDK's TypeScript types and openpayments.dev before writing calls. Never invent endpoints or methods.
Our app is the client: CLIENT_WALLET_ADDRESS + KEY_ID + PRIVATE_KEY, backend env only, never in the web bundle.

Online payment:
1. `walletAddress.get` for merchant + customer → authServer, resourceServer, assetCode, assetScale.
2. Non-interactive `incoming-payment` grant (merchant's auth server) → create incoming payment (incomingAmount, expiresAt, metadata).
3. Non-interactive `quote` grant (customer's auth server) → create quote (receiver = incoming payment URL, method 'ilp'). Show debitAmount vs receiveAmount.
4. INTERACTIVE `outgoing-payment` grant (customer's auth server; limits.debitAmount = quote.debitAmount; finish = redirect to our callback with a single-use nonce) → send customer to interact.redirect → on return verify the `hash` param → `grant.continue` with interact_ref.
5. Create outgoing payment with quoteId → PaymentWatcher polls the incoming payment until completed → SSE to merchant.

Tab (pre-authorised):
- Open: interactive outgoing-payment grant with limits { debitAmount: weekly cap, interval: 'R/<start ISO 8601>/P1W' }. Store access token + manage/continue URIs encrypted; rotate expired tokens via `token.rotate`.
- Settle: steps 2, 3 and 5 with the stored tab grant, no customer interaction.

Money is always `{ value: string (minor units), assetCode, assetScale }`, never floats. Display with Intl.NumberFormat('en-ZA', { style: 'currency', currency: assetCode }).
Every failure gets a clear UI state: consent declined, quote expired, insufficient funds, token expired, cap reached.

## Offline voucher protocol (Feature 4)
- Opening a tab: customer device generates an ECDSA P-256 key pair (WebCrypto, non-extractable, kept in IndexedDB); public JWK registered with the tab.
- Offline sale: merchant enters amount → "request" QR (tabId, shopId, amount, nonce, ts) → customer app shows shop + amount, customer approves, app signs the exact string `v1|tabId|shopId|amount|nonce|ts` → "voucher" QR → merchant scans → both phones store it in their outbox → merchant sees "Saved – settles when online".
- Merchant app rejects vouchers above the tab's remaining cap (tracked locally since last sync).
- Server on sync: verify with `crypto.subtle` (same P1363 signature format as the browser; node:crypto defaults to DER), nonce unused, ts ≤ 72 h old, within cap → settle via tab grant, else reject with a reason. Dedupe by nonce so whichever phone syncs first wins.
- Short ids (nanoid) + base64url so QR codes stay small and scan fast on cheap cameras.

## Low-data budget
- First load ≤ 200 KB gzipped JS+CSS; repeat visits ≈ 0 KB. Route-level code splitting; lazy-load the scanner.
- System fonts only, SVG icons only, no images in the app shell, minimal JSON, SSE for live updates (phones never poll).
- Lighthouse mobile: Performance and Accessibility ≥ 90. Report bundle size after each build.

## Design system: calm, Apple-like
Look at docs/design/refs/ before building UI:
- ledger-green.png: base look (warm off-white, deep green, huge amounts, ledger cards)
- wallet-blue.png: floating pill tab bar, round quick actions
- onboarding-mono.png: bold monochrome onboarding
- dark-mode.png: dark theme mood
Tokens as CSS variables → Tailwind v4 `@theme` (all text pairs pre-checked ≥ 4.5:1):
- light: bg #F5F2EA, surface #FFFFFF, ink #1C1F1A, muted #5F6358, brand #1F4D3A (on-brand #FFFFFF), danger #B42318, warn #8A5A00
- dark: bg #0F1211, surface #181C1A, ink #F2F0EA, muted #A3A89E, brand #5BD19A (on-brand #0F1211), danger #FF8A7A, warn #F5B544
Rules:
- Font stack `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. rem only, fluid with clamp(). Large titles weight 700, letter-spacing -0.02em. Amounts are the biggest thing on screen, `tabular-nums`, cents smaller.
- 0.25rem spacing scale, 1.25rem card radius, pill buttons, one primary action per screen in the thumb zone, bottom sheets for confirmations.
- Spring animations (~300 ms) for sheets, tab switches, success tick; honour prefers-reduced-motion. Blur only on the tab bar, with a solid @supports fallback.
- Touch targets ≥ 3rem. Amount entry: custom keypad, inputmode="decimal".
- Design every state: empty, loading (skeleton), offline, error, success.
- No SF Pro / SF Symbols (Apple-platforms licence). Theme follows prefers-color-scheme with a manual toggle.

## Accessibility
Semantic landmarks, one h1 per page, labelled inputs, visible focus, focus managed on route change and sheets, `aria-live="polite"` for payment status, status never shown by colour alone, usable at 200% text size. Voice confirm via Web Speech API (toggle). All strings via i18next: English + one South African language checked by a native speaker.

## Security
- Secrets only in env; commit .env.example; validate env with zod at startup.
- zod at every API edge, body size limit, helmet, CORS locked to the web origin, rate limits on payment routes.
- Wallet addresses are user input (SSRF risk): https only, block IP literals/localhost/private ranges, host allowlist from env (e.g. ilp.interledger-test.dev). The auth/resource server URLs they return are untrusted too.
- Verify the grant-callback `hash`, single-use nonces, encrypted tokens; no PII or tokens in logs (structured logs + correlation id).

## Code quality (SonarCloud)
- DRY: shared logic in hooks, utils, packages/shared. Cognitive complexity ≤ 15 per function; early returns; small pure functions.
- Comment the why (protocol steps, trade-offs), not the obvious what. JSDoc on public service methods.
- Vitest for money utils, voucher sign/verify, orchestrator transitions, idempotent re-sync (mock the gateway).
- A task is done only when `npm run lint && npm run test && npm run build` pass.

## How to work with me
- Multi-file tasks: short plan first, then implement.
- Before code, 2–4 bullets on the why behind architecture choices.
- Log decisions in docs/decisions.md (1–3 lines each); it feeds our "design process" slides.
- Demo reliability: seed script (demo merchant + customer), DEMO_MODE banner, "Simulate offline" toggle, README steps for judges.
- Unsure how Open Payments behaves? Say so and check the docs; don't guess.