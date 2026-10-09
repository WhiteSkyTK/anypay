# Translations

| Language                  | Code  | File               | Status                             |
| ------------------------- | ----- | ------------------ | ---------------------------------- |
| English                   | `en`  | `locales/en.json`  | Source of truth                    |
| Sepedi (Sesotho sa Leboa) | `nso` | `locales/nso.json` | Draft, needs native-speaker review |
| isiXhosa                  | `xh`  | `locales/xh.json`  | Draft, needs native-speaker review |
| isiZulu                   | `zu`  | `locales/zu.json`  | Draft, needs native-speaker review |

The drafts were written with an AI assistant. Before the demo, ask a native speaker to read every
string in the app (not just this file) and fix anything that sounds unnatural. Words to check
first, because there is no settled everyday term:

- **"Tab"** (the Offline Digital Tab): drafted as _Ithebhu_ (zu, xh) and _Akhaonte_ (nso).
- **"Wallet"**, **"QR code"** and **"data"**: kept close to the English loanwords people use.

## Adding or changing a string

1. Add the key to `en.json` first.
2. Add the same key to every other locale. The build fails if a locale is missing a key, and
   `locales.test.ts` checks that keys and `{{placeholders}}` match exactly.
3. Use it with `t('section.key')`; keys are type-checked.

Only English is in the main bundle. Other languages load on demand, so a phone downloads only its
own language, and the service worker caches them all for offline use.
