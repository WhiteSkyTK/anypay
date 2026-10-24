import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { type BuildManifest, customerFiles, customerPrecache } from './pwa-precache.ts'

// A small build: the shell, the pay screen (sharing a chunk with the shop's feed), and the shop's
// feed, which lazily loads the offline store.
const MANIFEST: BuildManifest = {
  'index.html': {
    file: 'assets/index-1.js',
    css: ['assets/index-1.css'],
    imports: ['_react-1.js'],
  },
  '_react-1.js': { file: 'assets/react-1.js' },
  '_shared-1.js': { file: 'assets/shared-1.js' },
  'src/pages/PayPage.tsx': {
    file: 'assets/PayPage-1.js',
    imports: ['_shared-1.js'],
    dynamicImports: ['src/components/QuoteSheet.tsx'],
  },
  'src/components/QuoteSheet.tsx': { file: 'assets/QuoteSheet-1.js' },
  'src/pages/MerchantPage.tsx': {
    file: 'assets/MerchantPage-1.js',
    imports: ['_shared-1.js'],
    dynamicImports: ['src/offline/index.ts'],
  },
  'src/offline/index.ts': { file: 'assets/offline-1.js' },
}

describe('customerFiles', () => {
  it('keeps the shell and the paying screens, with what they import', () => {
    expect([...customerFiles(MANIFEST)].sort()).toEqual(
      [
        'assets/index-1.js',
        'assets/index-1.css',
        'assets/react-1.js',
        'assets/PayPage-1.js',
        'assets/shared-1.js',
        'assets/QuoteSheet-1.js',
      ].sort(),
    )
  })
})

describe('customerPrecache', () => {
  let dist = ''
  afterEach(() => rm(dist, { recursive: true, force: true }))

  it('drops the shop’s screens and the offline store, never index.html or icons', async () => {
    dist = await mkdtemp(join(tmpdir(), 'anypay-dist-'))
    await mkdir(join(dist, '.vite'))
    await writeFile(join(dist, '.vite', 'manifest.json'), JSON.stringify(MANIFEST))
    const entry = (url: string) => ({ url, revision: null, size: 1 })
    const { manifest } = await customerPrecache(dist)([
      entry('index.html'),
      entry('pwa-192x192.png'),
      entry('manifest.webmanifest'),
      entry('assets/index-1.js'),
      entry('assets/PayPage-1.js'),
      entry('assets/MerchantPage-1.js'),
      entry('assets/offline-1.js'),
    ])
    expect(manifest.map((kept) => kept.url)).toEqual([
      'index.html',
      'pwa-192x192.png',
      'manifest.webmanifest',
      'assets/index-1.js',
      'assets/PayPage-1.js',
    ])
  })
})
