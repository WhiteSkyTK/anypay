import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { cspPlugin } from './csp.ts'
import { customerPrecache } from './pwa-precache.ts'

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const { version } = JSON.parse(readFileSync(fromHere('./package.json'), 'utf8')) as {
  version: string
}

// One .env at the repo root serves both apps; Vite only exposes VITE_* values to the browser.
const envDir = fromHere('../..')

export default defineConfig(({ mode }) => {
  // Not PORT: that is the API's own variable, and dev tools often set it for the web server too.
  const env = loadEnv(mode, envDir, '')
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:3000'

  return {
    envDir,
    define: { __APP_VERSION__: JSON.stringify(version) },
    // dist/.vite/manifest.json maps pages to chunks, so scripts/report-size.mjs can measure each
    // page's real first load.
    build: { manifest: true },
    resolve: {
      alias: { '@': fromHere('./src') },
    },
    // Same-origin /api in dev, so no CORS setup is needed locally.
    server: {
      proxy: { '/api': apiTarget, '/health': apiTarget },
    },
    plugins: [
      react(),
      tailwindcss(),
      cspPlugin(env.VITE_API_URL),
      VitePWA({
        // 'prompt', not 'autoUpdate': a silent reload mid-payment would lose the customer's place.
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          name: 'AnyPay',
          short_name: 'AnyPay',
          description: 'Pay any spaza from any wallet, even offline.',
          lang: 'en',
          // The id keeps installs recognised; ?source=pwa tells the start page it was launched as
          // the installed app, so a shop's phone opens straight into its live feed.
          id: '/',
          start_url: '/?source=pwa',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#f5f2ea',
          background_color: '#f5f2ea',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Precache the shell and the customer's screens, so the app opens offline; the shop's
          // screens and the offline store are cached when a phone first needs them.
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          manifestTransforms: [customerPrecache(fromHere('./dist'))],
          runtimeCaching: [
            {
              // Hashed file names: a cached copy is never out of date.
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && url.pathname.startsWith('/assets/'),
              handler: 'CacheFirst',
              options: { cacheName: 'anypay-assets', expiration: { maxEntries: 150 } },
            },
          ],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  }
})
