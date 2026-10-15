import { z } from 'zod/mini'

// zod's fast parser compiles code with `new Function`, which our Content-Security-Policy forbids.
// Without this, zod probes for it on first parse and the browser logs a CSP violation (a failed
// Lighthouse check) before zod falls back. Imported first in main.tsx, before anything parses.
z.config({ jitless: true })
