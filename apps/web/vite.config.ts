import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const { version } = JSON.parse(readFileSync(fromHere('./package.json'), 'utf8')) as {
  version: string
}

// One .env at the repo root serves both apps; Vite only exposes VITE_* values to the browser.
const envDir = fromHere('../..')

export default defineConfig(({ mode }) => {
  // Not PORT: that is the API's own variable, and dev tools often set it for the web server too.
  const apiTarget = loadEnv(mode, envDir, '').API_PROXY_TARGET || 'http://localhost:3000'

  return {
    envDir,
    define: { __APP_VERSION__: JSON.stringify(version) },
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
      VitePWA({
        // 'prompt', not 'autoUpdate': a silent reload mid-payment would lose the customer's place.
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          name: 'AnyPay',
          short_name: 'AnyPay',
          description: 'Pay any spaza from any wallet, even offline.',
          lang: 'en',
          start_url: '/',
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
          // Precache the whole shell, including every lazy route, so the app opens offline.
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  }
})
