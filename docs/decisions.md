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
- **The phone's language is detected; a manual choice wins.** A phone set to isiZulu opens in
  isiZulu with no setup. The picker is on the landing screen, not buried in Settings, because the
  first screen must already be readable.
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
