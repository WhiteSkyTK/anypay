import type { Plugin } from 'vite'

/**
 * The web app's Content-Security-Policy: scripts, styles and data only from this site and the
 * AnyPay API, so injected markup can't load or send anything elsewhere (the merchant token lives
 * in this origin's storage). Built into index.html, so every host serves it and `vite preview`
 * tests it. frame-ancestors can't be set in a <meta>; render.yaml sends X-Frame-Options instead.
 */
export function contentSecurityPolicy(apiUrl: string | undefined): string {
  const api = apiUrl ? new URL(apiUrl).origin : ''
  return [
    "default-src 'self'",
    "script-src 'self'",
    // Inline style attributes and the bottom sheet's injected <style>; never scripts.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    ['connect-src', "'self'", api].filter(Boolean).join(' '),
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/** Adds the policy to built pages only: the dev server needs inline scripts for hot reload. */
export function cspPlugin(apiUrl: string | undefined): Plugin {
  return {
    name: 'anypay-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(apiUrl) },
        injectTo: 'head-prepend',
      },
    ],
  }
}
