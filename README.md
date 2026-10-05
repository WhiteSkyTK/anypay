# AnyPay

**Pay any spaza from any wallet, even offline.**

A proof of concept for the Cape Town Software Development Meetup × Interledger Foundation hackathon.
Spaza shops take digital payments with no card machine, very little data and tolerance for poor
or no signal, using [Open Payments](https://openpayments.dev/) so customers can pay from any
compatible wallet.

> Status: Phase 1. Real Open Payments payments work from the terminal (`npm run demo:pay`); the
> app screens come in Phase 2. See [ROADMAP.md](ROADMAP.md).

## Quick start

You need [Node.js 22 or newer](https://nodejs.org/) (LTS) and Git. Works on Windows, macOS and Linux.

```bash
git clone https://github.com/WhiteSkyTK/anypay.git
cd anypay
npm install
```

Copy the example environment file (it works as-is for local development):

```bash
cp .env.example .env
```

On Windows PowerShell use `Copy-Item .env.example .env` instead. Then start the API and the web app together:

```bash
npm run dev
```

- Web app: <http://localhost:5173>
- API health check: <http://localhost:3000/health> (also proxied at <http://localhost:5173/health>)

## Try a real Open Payments payment

This runs the whole flow against the Interledger test wallet (play money): the shop's payment
request, a quote with fees and exchange rate, the customer's approval in their own wallet, and
the payment arriving.

1. In `.env`, set `CLIENT_WALLET_ADDRESS`, `KEY_ID` and `PRIVATE_KEY` for the AnyPay app wallet.
   Get them from a teammate privately; never commit them or paste them in chat.
2. Run:

   ```bash
   npm run demo:pay -- --amount 25.00
   ```

3. Open the link it prints, log in to the customer's test wallet and approve. The browser comes
   back to a local page, the script checks the approval and sends the payment, then waits until
   the shop has received it. Check both balances in the test wallet.

The customer and shop default to `DEMO_CUSTOMER_WALLET` and `DEMO_MERCHANT_WALLET` in `.env`; use
`--from` and `--to` for others. Pass `https://` addresses, or put `$` addresses in single quotes:
PowerShell and bash treat `$` as a variable. If the approval page can't redirect back, add
`--no-callback` and press Enter after approving.

## Scripts

Run from the repo root.

| Command                              | What it does                                                          |
| ------------------------------------ | --------------------------------------------------------------------- |
| `npm run dev`                        | API (port 3000) and web app (port 5173) with live reload              |
| `npm run build`                      | Production builds, plus the web bundle size against the 200 KB budget |
| `npm run lint`                       | ESLint, including SonarCloud's rules (eslint-plugin-sonarjs)          |
| `npm run format`                     | Format everything with Prettier (`format:check` only checks)          |
| `npm run typecheck`                  | TypeScript in strict mode, all workspaces                             |
| `npm test`                           | Vitest across all workspaces (`test:coverage` adds an lcov report)    |
| `npm run preview -w @anypay/web`     | Serve the production web build, to test the PWA and offline mode      |
| `npm run demo:pay -- --amount 25.00` | A real test-wallet payment from the terminal (see above)              |

A change is done when `npm run lint && npm test && npm run build` passes. CI runs the same
checks on Ubuntu and Windows for every pull request.

## Project structure

```
apps/
  api/        Node + Express 5 API (TypeScript, OOP, one composition root)
  web/        React + Vite PWA (Tailwind CSS v4, shadcn/ui, React Router, i18next)
packages/
  shared/     Money utils and zod schemas used by both apps
docs/
  design/refs/   Visual references for the design system
  decisions.md   Why things are built the way they are
```

## Security

The repo is public. Secrets live only in `.env` (gitignored) and are validated at startup;
`.env.example` documents every variable. Never commit `.env`, `*.key` or `*.pem` files.

## Acknowledgements

Built with [Claude Code](https://claude.com/claude-code) as an AI pair programmer. A full list of
libraries and tools will be added before submission.
