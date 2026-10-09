/** App version from package.json, injected at build time by vite.config.ts. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** The API's origin in production (e.g. https://api.anypay.example). Empty in dev: Vite proxies /api. */
  readonly VITE_API_URL?: string
}
