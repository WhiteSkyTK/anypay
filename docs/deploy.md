# Deploying AnyPay

Two pieces, one Render Blueprint ([render.yaml](../render.yaml)) and a Neon database:

| Piece    | Where                         | Sleeps?                                         |
| -------- | ----------------------------- | ----------------------------------------------- |
| Web app  | Render static site (CDN)      | Never                                           |
| API      | Render web service, Frankfurt | Free plan: after 15 idle min (≈1 min to wake)   |
| Postgres | Neon free plan                | Compute pauses after 5 idle min (wakes in ≈1 s) |

The API holds live connections (SSE) and polls wallets, so it must run as one always-on process,
not serverless functions. **For demo week, move the API to Render's smallest paid instance**, or
open `https://<api>/health` a few minutes before presenting so judges never wait for a cold start.
Free-tier rules change often: check Render's and Neon's pricing pages before relying on them.

## 1. Database (Neon)

1. Sign up at <https://neon.tech> and create a project in the region closest to Frankfurt
   (e.g. AWS eu-central-1).
2. Copy the **pooled** connection string: it starts with `postgresql://`, its host contains
   `-pooler`, and it includes `sslmode=require`. Use it exactly as Neon shows it.
   It is a secret: paste it only into Render, never into the repo or chat.

Tables are created automatically when the API starts (migrations in
`apps/api/src/db/migrations.ts`, guarded by a lock so two instances can't race).

## 2. Render Blueprint

1. Sign up at <https://render.com> with GitHub and allow access to the `anypay` repo.
2. **New → Blueprint**, pick the repo and branch (`main` once Phase 2 is merged). Render reads
   `render.yaml` and asks for the `sync: false` values:

   | Variable                            | Value                                                                     |
   | ----------------------------------- | ------------------------------------------------------------------------- |
   | `DATABASE_URL`                      | Neon pooled connection string                                             |
   | `TOKEN_ENCRYPTION_KEY`              | A **new** key (below), not the one in your local `.env`                   |
   | `CLIENT_WALLET_ADDRESS`             | AnyPay app wallet, e.g. `https://ilp.interledger-test.dev/889920ca`       |
   | `KEY_ID`, `PRIVATE_KEY`             | Same as your local `.env`                                                 |
   | `WEB_ORIGIN`                        | `https://anypay-web.onrender.com` (fix in step 3 if Render picks another) |
   | `PUBLIC_API_URL`                    | `https://anypay-api.onrender.com`                                         |
   | `VITE_API_URL` (on the web service) | Same as `PUBLIC_API_URL`                                                  |

   New encryption key:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

3. When both services exist, check their real URLs on the Render dashboard. If a name was taken,
   Render adds a suffix: update `WEB_ORIGIN`, `PUBLIC_API_URL` and `VITE_API_URL` to match, then
   **Manual Deploy** the web service (`VITE_API_URL` is baked in at build time).

The API refuses to start in production without `DATABASE_URL` and `TOKEN_ENCRYPTION_KEY`, and the
web build fails if the first load goes over 200 KB, so a broken deploy shows up in the build log
instead of during a payment.

## 3. Check it

1. `https://<api>/health` returns `{"status":"ok",…}`.
2. Open the web URL on your phone → **Set up my shop** with the shop wallet → print or show the
   poster.
3. On a second phone, scan the poster, pay with the customer wallet and approve.
4. The shop phone shows **Received** and says "Payment received" within a few seconds. That is
   Phase 2's "Done when".

## Demo data

`npm run seed` creates a demo shop (on `DEMO_MERCHANT_WALLET`) through a running API and prints a
private sign-in link for the shop phone plus the customer's pay link. For the deployed app, run it
from your PC with `--target deployed` (the addresses are fixed in the script, so it can only ever talk to
AnyPay's own servers):

```bash
npm run seed -- --target deployed
```

## Notes

- **Phones and HTTPS.** Render serves HTTPS, which the PWA (install, offline shell) and the
  wallet redirects need. Plain `http://` on a LAN works for testing payments but not for
  installing, and not for offline tabs (signing vouchers needs a secure context; the app says so).
- **Logs** contain request paths, never query strings, tokens or wallet addresses. The merchant
  feed opens with a one-minute ticket (`?ticket=`, bought with the token in a header), so even a
  hosting proxy that logs full URLs only ever sees an expired ticket. App versions from before
  tickets still send `?token=` until they update.
- **Rate limits** count real client IPs because `TRUST_PROXY=1` tells Express about Render's proxy.

## Security checklist

What protects the live app, and what to keep doing:

- **Secrets** live only in Render's environment settings and your local `.env` (gitignored).
  Never paste them into tracked files or chats. If one leaks, rotate it: a new Neon password, a
  new `TOKEN_ENCRYPTION_KEY` (existing payment sessions then can't be read, so do it between
  demos), or a new developer key in the test wallet.
- **Local development never uses the production database.** Leave `DATABASE_URL` empty in your
  `.env` (the API uses its own local database), or point it at a separate Neon branch.
- **Content-Security-Policy** is built into the page (`apps/web/csp.ts`): scripts only from the
  site itself, data only to the site and the API. If you move the API to another address, set
  `VITE_API_URL` and redeploy the web service so the policy follows.
- **Other headers** (no framing, no sniffing, camera only for this site) come from `render.yaml`.
  Render applies Blueprint changes on sync: after merging, open the Blueprint and press
  **Manual sync** if the new headers don't show up (check with your browser's dev tools).
- **Rate limits**: 600 requests a minute per address on every API route, 30 on routes that create
  things or call wallets, and at most 50 open live feeds per address (2000 in total).
- **Input checks**: shop names without hidden characters, amounts under one billion, shop codes
  checked before any database lookup, and only `https` wallet approval pages are ever opened.
- **Dependencies**: `npm audit` reports 0 known vulnerabilities (2026-10-14). Merge Dependabot pull
  requests only when CI is green.
