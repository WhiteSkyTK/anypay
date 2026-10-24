# Decisions

Why AnyPay is built the way it is, one to three lines each. Feeds the "design process" slides.

## Phase 0: Scaffold (2026-10-05)

- **One PWA instead of native apps.** One React codebase runs on Android, iOS and desktop, installs
  to the home screen and works offline. Judges only need a link, and there's no app store.
- **Shared package ships TypeScript source.** Vite and tsx compile it directly and the API's
  esbuild bundle inlines it, so there is no build step and no stale `dist` on Windows.
- **One ESLint and Prettier setup for all workspaces, with eslint-plugin-sonarjs.** SonarCloud's
  rules (cognitive complexity ≤ 15) fail locally before they reach CI.
- **Design tokens are shadcn's CSS variables.** Every shadcn component gets the AnyPay palette with
  no per-component styling. A test enforces WCAG contrast in both themes: 4.5:1 for text, 3:1 for
  form outlines and focus rings. It caught one input border at 2.99:1.
- **Theme is a class on `<html>`, set by an inline script before first paint.** No flash of the
  wrong theme, a manual choice overrides the OS, and one screen (onboarding) can opt into dark.
- **Text labels under tab bar icons.** The wallet-blue reference uses icons only; new and
  low-literacy users need words. The active tab is a filled pill, so it isn't shown by colour alone.
- **System fonts only.** `shadcn init` added the Geist web font; removed to save a download on
  prepaid data.
- **Vendored shadcn's Tailwind CSS rather than depending on the `shadcn` CLI.** The CLI brought 7
  high-severity audit findings (braces via fast-glob). The CSS is build-time only; components are
  still added with `npx shadcn add`.
- **PWA updates on prompt, not automatically.** An automatic reload mid-payment would lose the
  customer's place.
- **i18next from day one, with type-checked keys.** No retrofit later, and a missing key fails the
  build. Validation messages in `packages/shared` are i18n keys, not English text.
- **Every page is lazy-loaded; `@anypay/shared` is marked side-effect free.** First load is
  138.8 KB gzipped of the 200 KB budget. The side-effect flag removed 24 KB of zod from pages
  that only format money.
- **One root `.env` for both apps.** Simpler for the team; Vite only exposes `VITE_*` values to the
  browser. The web dev proxy uses its own `API_PROXY_TARGET`, because dev tools often set `PORT`.
- **Service skeletons take no constructor parameters yet.** Unused injected fields fail strict
  TypeScript; the composition root documents the dependency graph and Phase 1 adds the parameters.
- **Error responses never leak internals.** A single error handler maps known errors to a code the
  UI can act on, returns a correlation id, and hides everything else behind `internal_error`.
- **CI runs on Ubuntu and Windows.** The team develops on Windows, so cross-platform scripts are
  verified rather than assumed.

## Phase 0 follow-ups (2026-10-05)

- **Four languages: English, Sepedi, isiXhosa, isiZulu.** The team's choice for the spaza owners we
  expect to meet. Non-English strings are AI drafts until a native speaker reviews them. Only
  English is bundled; each other language is its own chunk, so a phone downloads only its own.
- **Everyone starts in English; a chosen language is remembered.** Team decision: a predictable
  first screen for the demo and for phones shared in a shop. The picker is on the landing screen,
  not buried in Settings, so switching is one tap away. (Replaces earlier phone-language detection.)
- **Money is always formatted en-ZA (R 25,00), whatever the language.** Amounts must look the same
  on the customer's and the merchant's phone, even if they use different languages.
- **Landing page sized to the screen.** The illustration only takes leftover space, so longer
  translations and small phones never push "Set up my shop" below the fold. iOS Safari's status
  bar and overscroll stay dark on this screen (data-chrome flag) instead of showing a cream band.
- **Secret scanners stay quiet on test data.** Test keys are generated at run time instead of
  written as literals; GitGuardian flagged one fake value, which was never a real secret.
- **CI supply-chain hardening.** Third-party actions are pinned to commit SHAs (Dependabot keeps
  them current) and `npm ci --ignore-scripts` stops dependencies running code at install time.
- **SonarCloud scope.** Vendored shadcn CSS is excluded: its Tailwind-only syntax produced 72 false
  "bugs". Automatic Analysis reads `.sonarcloud.properties`; the CI scanner reads
  `sonar-project.properties`. Both are kept in sync.

## Phase 1: Open Payments works end to end (2026-10-06)

- **Only the gateway imports the SDK.** The rest of the API uses AnyPay's own types and a small
  port interface, so tests swap in a fake wallet and an SDK upgrade touches one file.
- **The payment is an explicit state machine:** created → incoming payment → quoted → awaiting
  consent → sending → completed or failed. Expected failures (declined, expired quote, limit,
  insufficient funds) end in `failed` with one reason the UI can show; anything unexpected is
  thrown, so real bugs are never mistaken for a declined payment.
- **The consent grant is capped at exactly the quote's debit amount**, so an approved grant can't
  be reused to take more.
- **The callback hash is verified before continuing the grant**, in constant time, with a fresh
  24-byte nonce per payment. It tolerates padded or unpadded base64 and a `+` that arrives as a
  space, because the spec and its own example disagree on padding.
- **SSRF allowlist includes subdomains.** The test wallet's auth server is on
  `auth.interledger-test.dev` with a tenant path, not on the wallet's host. The auth and resource
  servers a wallet returns are checked too, and IP literals and local names are refused even if
  the allowlist is misconfigured.
- **Insufficient funds is detected by polling.** The wallet funds a payment after it is created,
  so a customer without enough money shows up as a failed payment that sent nothing.
- **The SDK client is created lazily.** The API boots and serves `/health` without credentials
  (CI, fresh clones); payment calls then fail with a clear "not configured" error.
- **The demo CLI uses a real callback on 127.0.0.1.** That exercises the same hash check the web
  app needs in Phase 2, against the real test wallet, with `--no-callback` as a fallback.
- **Only AnyPay's own wallet needs a key.** Customers and shops approve in their own wallets, so
  their keys never enter AnyPay. Keys live only in `.env` (or `.secrets/`), both gitignored.
- **`uuid` is overridden to 11.1.1** to clear a moderate advisory in the SDK's dependency. npm
  only applies overrides when it resolves from scratch, so the lockfile was regenerated from the
  manifests. If `npm ls` ever shows the signing library's `structured-headers` as invalid,
  regenerate the lockfile the same way (a half-edited lockfile broke request signing once).

## Phase 2: Shops, payments and the live feed (2026-10-09)

- **PGlite locally, Neon in production, same SQL.** A fresh clone needs no database setup, and
  the tests run against real Postgres semantics. Migrations are hand-written SQL behind an
  advisory lock; drizzle-kit was dropped over an old esbuild advisory.
- **Payment sessions are encrypted whole (AES-256-GCM).** Grant tokens, continue URIs and the
  customer's wallet address never sit in the database in plain text; only amounts and status do.
- **Shop ids are public, merchant tokens are not.** The poster's QR holds only the shop id; the
  feed and CSV need a 32-byte token whose SHA-256 hash is stored. The sign-in link carries it in
  the URL fragment, which browsers never send to servers, and the app strips it on arrival.
- **SSE for the live feed.** One long-lived HTTP response, no polling from phones, automatic
  reconnects, and it passes through proxies that block WebSockets. EventSource can't send
  headers, so the merchant token goes in the query string; our logs record paths only.
- **Idempotency-Key on every money-moving route.** A double tap or a retry on a bad connection
  returns the first result instead of creating a second payment.
- **A custom keypad instead of the phone keyboard.** Big keys, the same on every phone, it never
  covers the amount, and it can't produce an invalid number. Typing still works for keyboards and
  screen readers.
- **The quote sheet loads when the customer presses Continue.** It is most of the pay screen's
  code (vaul + Radix Dialog) and downloads while the quote is fetched, so a first scan stays at
  186 KB instead of 206 KB. The size report now measures each page's real first load from Vite's
  manifest instead of guessing.
- **Speech uses the browser's own voices.** No audio files to download; it falls back to English
  when a phone has no voice for the chosen language.
- **Render Blueprint + Neon.** One file deploys both services; the static site never sleeps. The
  API is one always-on process because it holds SSE connections and polls wallets.
- **The wallet field asks for a name, not an address.** Every test-wallet address is
  `$ilp.interledger-test.dev/<name>`, so typing only the name is faster and harder to get wrong
  on a small phone. It stays one input in both modes, so pasting a full address or switching to
  another provider never loses the caret, and other Open Payments wallets keep working.
- **Config mistakes fail at deploy time.** A missing `.com` in `VITE_API_URL` showed up only as
  "No connection" on phones, so the web build now checks that the host exists, and the API warns
  when `PUBLIC_API_URL` (where wallets send customers back) doesn't reach it.
- **Idempotency replies are encrypted too.** They are full API responses, and a new shop's
  response contains its merchant token; hashing the token in `shops` meant nothing while the
  replay cache kept it readable. They are also deleted after a day: retries come within minutes.

## Phase 2 hardening: getting around and safety (2026-10-14)

- **Every screen without the tab bar has a way back or onward.** An installed app on iPhone has
  no browser Back button, so a page with no button is a dead end. "Back" goes back inside the app
  when it can, and to a sensible parent (Pay a shop, the shop, the start page) when the page was
  opened directly from a QR code, a link or the wallet.
- **The start page knows the phone's shop, and set-up won't silently replace it.** Only the phone
  that created a shop holds its sign-in; replacing it by accident locked owners out for good.
- **Customers get a start page too.** The phone's camera does the scanning (no in-app scanner to
  download yet; Phase 3 needs one anyway), with the printed shop code as the fallback. New codes
  use 31 unambiguous characters in one case, so they can be read out and typed.
- **Back from the wallet restores the price sheet.** Browsers keep the page as it was left
  (back-forward cache), which froze it on "Opening your wallet…".
- **Limits for scripts, not people.** A ceiling on every API route and on open live feeds stops
  floods; the numbers are high because mobile networks share one address between many phones.
- **The Content-Security-Policy lives in the page, built with the API address it was built for**,
  so it is right on any host and testable with `vite preview`. The first-paint theme script moved
  to a file so the policy can forbid every inline script.
- **The wallet's approval link must be https**, checked on the server and again in the app: it is
  input from an outside server, and the customer's browser is sent there.

## Phase 3: the Offline Digital Tab (2026-10-15)

- **One protocol module, shared by both phones and the server.** The voucher message, the links
  and ECDSA P-256 signing live in packages/shared and use WebCrypto everywhere, so a voucher the
  shop's phone accepts offline is exactly one the server accepts (P1363 signatures on both sides).
- **Both QR codes are ordinary AnyPay links** (/t/… and /v/…): the in-app scanner reads them, and
  so does a phone's own camera app, so neither phone strictly needs to install anything.
- **The customer supplies the tab id.** The shop's request QR carries shop, amount, nonce and
  time; the customer's phone adds its own tab id when signing, so the shop never has to pick the
  customer from a list. The signature still binds all six fields.
- **The weekly cap is approved in the customer's currency and checked in the shop's.** The grant
  limit is what the customer sees in their wallet (rand); a fixed-send quote into an open-amount
  incoming payment converts it once (R200 -> COP 38 416,62 on the test wallet), so the shop's
  phone can compare vouchers offline. The wallet's own limit remains the hard stop.
- **"Settle at most once" is a primary key.** Vouchers are keyed by nonce and claimed with one
  atomic insert, so two phones syncing the same voucher at the same moment can't both pay it.
- **The offline store loads only when needed.** Dexie (30 KB) and the scanner (16 KB) are their own
  chunks; a customer who only scans and pays never downloads them, and every page's first load
  stays under 200 KB (heaviest: the shop feed, 195.6 KB).
- **Sync is ours, not the Background Sync API** (iOS Safari lacks it): flush on online, on
  returning to the app, and on a 2 s → 5 min backoff, with each voucher's own Idempotency-Key.
- **The seed script can't be pointed at any server** (SonarCloud S8703): `--target local|deployed`.

## Phase 4: polish (2026-10-15)

- **zod/mini for the shared contract.** The web app checks every response against the shared
  schemas, so classic zod (24 KB gz) sat on every first load. zod/mini has the same rules with
  functional checks: 8 KB, and the heaviest first load fell from 196 KB to 181.5 KB. The API's own
  schemas stay classic; both run on zod's shared core.
- **zod's fast parser is off in the browser** (`jitless`). It compiles with `new Function`, which
  our CSP forbids; leaving it on made Chrome log a CSP violation on every page.
- **The pay screen asks for the shop while its code downloads.** The route's loader starts the
  request in parallel with the lazy page chunk, so a first scan waits for one round trip, not two.
- **A launch mark instead of a blank screen.** index.html shows the AnyPay mark until the first
  screen paints, then a layout effect removes it in the same frame (no flash, no layout shift).
  On a slow connection the page shows something at once instead of a blank cream screen.
- **"Can't reach AnyPay" is not "receipt not found".** A receipt whose live stream gives up asks
  once over plain HTTP: 404 means not found; anything else (asleep, 502 behind a proxy) shows a
  calm "your payment is safe in your wallet" and keeps retrying.
- **A privacy page that says only what the code does.** What's stored (and what's encrypted), what
  stays on the phone, what's never collected, who else is involved, and POPIA rights. Payments
  aren't deleted automatically yet, so the page says the demo keeps them until it's reset; retry
  records really are purged after a day (now every six hours, not only at start-up).
- **Motion only where it moves.** The success tick was the only animation, yet `LazyMotion` wrapped
  every page, so every first load carried the motion core and fetched the feature pack. It now
  lives in the tick (the receipt's chunk): the app shell fell to 162 KB and the pay screen's
  Lighthouse score from 86 to 92.
- **"Sign out other phones" with a token the phone picks.** The phone saves a fresh 32-byte token,
  then asks the API to switch to it. If the answer is lost, the old token is refused next time
  and the new one confirms the change, so a shop can't lock itself out. The switch also ends
  every open live feed, so a lost phone stops seeing sales at once.
- **Adding a phone is a QR code, hidden until asked for.** It's the existing sign-in link (token in
  the URL fragment, never sent to a server); the screen warns that anyone who scans it sees the
  shop's sales.

## Phase 4: what goes wrong on real phones (2026-10-16)

- **Every request times out after 60 s, and says "Still working…" after 4 s.** Long enough for a
  free server waking from sleep, short enough not to strand a customer on a dead connection.
  Every money-moving request is idempotent, so trying again is always safe.
- **The host's own error page is not our error.** A 502/503/504 that isn't AnyPay's JSON means
  the server is waking or restarting: "Try again in a minute", not "Something went wrong".
- **After a deploy, an open tab reloads once** (Vite's `vite:preloadError`), never in a loop.
- **The phone's clock is corrected by the server's.** Budget phones often have the wrong time
  (after a flat battery), and vouchers carry a time the server checks. Every API answer's `Date`
  header teaches the phone its offset; voucher stamps and freshness checks use it, and the sale
  screens ask the owner to fix the clock when it's ten minutes or more off.
- **Offline tabs say why they can't work** on a plain `http://` address (no WebCrypto) or with
  storage blocked, instead of a blank screen; a full phone gets "the sale wasn't saved". The app
  asks the browser to keep offline data (`navigator.storage.persist`) once a phone holds any.
- **"Keep the screen on" for the shop's feed** (Screen Wake Lock): a locked phone stops the live
  feed and the spoken confirmation.
- **The live feed opens with a one-minute ticket**, bought with the merchant token in a header,
  so the token never sits in a URL that proxies or hosting logs might keep. Signing out other
  phones revokes outstanding tickets too.
- **Refreshing tabs no longer flashes "No tabs yet".** Dexie 4's live queries show changes at once,
  so deleting all tabs before re-adding them blanked the screen, even over a sale QR.
- **Desk research before interviews** (docs/research/): it showed Afrikaans is the third most
  common home language and not yet offered, and that small data bundles cost about 14c per MB,
  which keeps the 200 KB budget honest.

## Phase 4: the tab under real use (2026-10-24)

- **The wallet's "limit reached" closes the week on both phones.** The phones check sales against
  the weekly limit converted to the shop's currency once, but each payment's fees and exchange
  rate can spend the wallet's limit sooner. Refused payments didn't count as used, so the phones
  kept taking sales that the wallet then refused: the tab looked stuck. Now the first refusal
  marks the week full (`limit_reached_at`) until it resets, and both phones say so.
- **A sale is never lost to a wallet-network outage.** If settling fails before any money moves,
  the voucher is given back and the phones send it again later. After a payment was sent, a
  failure stays final: trying again then could charge the customer twice.
- **The customer sees their own currency.** The shop asks in its currency; the approve screen
  adds "about R20,00 from your wallet", at the rate the tab was opened with.
- **Afrikaans added** because the desk research showed it is the third most common home
  language; the five languages cover about 70% of home languages.
- **Customers precache only the paying screens** (231 KB instead of 340 KB). The shop's and tab
  screens are cached on first use, and a phone that runs a shop or a tab fetches its own screens
  once in the background, so offline sales still open with no signal.
- **happy-dom lives at the root, next to Vitest.** A Dependabot update installed it inside the web
  app's folder, where Vitest couldn't find it, and CI failed before running a test.
