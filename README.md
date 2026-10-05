# AnyPay

**Pay any spaza from any wallet, even offline.**

A proof of concept for the Cape Town Software Development Meetup × Interledger Foundation hackathon.
Spaza shops take digital payments with no card machine, very little data and tolerance for poor
or no signal, using [Open Payments](https://openpayments.dev/) so customers can pay from any
compatible wallet.

> Status: Phase 0 (scaffold). There is no payment logic yet. See [ROADMAP.md](ROADMAP.md).

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

## Scripts

Run from the repo root.

| Command                          | What it does                                                          |
| -------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                    | API (port 3000) and web app (port 5173) with live reload              |
| `npm run build`                  | Production builds, plus the web bundle size against the 200 KB budget |
| `npm run lint`                   | ESLint, including SonarCloud's rules (eslint-plugin-sonarjs)          |
| `npm run format`                 | Format everything with Prettier (`format:check` only checks)          |
| `npm run typecheck`              | TypeScript in strict mode, all workspaces                             |
| `npm test`                       | Vitest across all workspaces (`test:coverage` adds an lcov report)    |
| `npm run preview -w @anypay/web` | Serve the production web build, to test the PWA and offline mode      |

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
