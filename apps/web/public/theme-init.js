// Applies the saved theme before first paint, so the page never flashes the wrong colours.
// Mirrors src/lib/theme.ts (storage key and colours); tokens.test.ts checks they match.
// A file, not an inline <script>, so the Content-Security-Policy can forbid inline scripts.
;(function () {
  var mode = 'system'
  try {
    mode = localStorage.getItem('anypay.theme') || 'system'
  } catch {
    // Storage blocked (private mode): follow the system theme.
  }
  var dark =
    mode === 'dark' ||
    (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  // The landing page is a full-bleed dark screen in both themes (see useDarkChrome).
  var landing = location.pathname === '/'
  if (landing) document.documentElement.dataset.chrome = 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document
    .querySelector('meta[name="theme-color"]')
    .setAttribute('content', dark || landing ? '#0f1211' : '#f5f2ea')
})()
