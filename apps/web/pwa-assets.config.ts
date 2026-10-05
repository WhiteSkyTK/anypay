import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Regenerate the app icons with `npm run pwa:assets -w @anypay/web` after changing the logo.
// The output PNGs are committed, so builds and CI never need the image toolchain.
const brandBackground = { background: '#1f4d3a' }

export default defineConfig({
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: brandBackground },
    apple: { ...preset.apple, resizeOptions: brandBackground },
  },
  images: ['public/favicon.svg'],
})
