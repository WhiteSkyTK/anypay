import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The part of Vite's build manifest the precache list needs. */
export type BuildManifest = Record<
  string,
  { file: string; css?: string[]; imports?: string[]; dynamicImports?: string[] }
>

/**
 * What a customer's phone needs before it has ever loaded anything else: the app shell and the
 * screens of paying a shop (the price sheet loads lazily but is part of every payment).
 */
export const CUSTOMER_SCREENS = [
  'index.html',
  'src/pages/OnboardingPage.tsx',
  'src/pages/CustomerPage.tsx',
  'src/pages/PayPage.tsx',
  'src/components/QuoteSheet.tsx',
  'src/pages/ReceiptPage.tsx',
  'src/pages/PrivacyPage.tsx',
  'src/pages/NotFoundPage.tsx',
]

/** Every JS and CSS file those screens run on: their chunks, their CSS and their static imports. */
export function customerFiles(manifest: BuildManifest): Set<string> {
  const files = new Set<string>()
  const visit = (key: string) => {
    const chunk = manifest[key]
    if (!chunk || files.has(chunk.file)) return
    files.add(chunk.file)
    for (const css of chunk.css ?? []) files.add(css)
    for (const imported of chunk.imports ?? []) visit(imported)
  }
  CUSTOMER_SCREENS.forEach(visit)
  return files
}

interface PrecacheEntry {
  url: string
  size: number
}

/**
 * A Workbox manifest transform: precache only what customers need, so a first scan on prepaid
 * data doesn't also download the shop's screens, the offline store and the scanner (about a third
 * of the app). Everything else is cached the first time it loads (see runtimeCaching), and phones
 * that run a shop or a tab fetch their own screens once in the background (lib/warm-screens.ts).
 * Non-code files (index.html, icons, the web manifest) are always kept.
 */
export function customerPrecache(distDir: string) {
  return async <T extends PrecacheEntry>(entries: T[]) => {
    const manifest = JSON.parse(
      await readFile(join(distDir, '.vite', 'manifest.json'), 'utf8'),
    ) as BuildManifest
    const keep = customerFiles(manifest)
    const isCode = (url: string) => /\.(js|css)$/.test(url)
    return {
      manifest: entries.filter((entry) => !isCode(entry.url) || keep.has(entry.url)),
      warnings: [],
    }
  }
}
