const STORAGE_KEY = 'anypay.staleReloadAt'
// A second failure this soon after reloading is a real problem (offline, a broken deploy), not an
// old build: let the error screen show instead of reloading in a loop.
const RETRY_WINDOW_MS = 30_000

/** When this tab last reloaded for a stale build, after noting `now`; null if it can't tell. */
function swapLastReload(storage: Storage, now: number): number | null {
  try {
    const last = Number(storage.getItem(STORAGE_KEY)) || 0
    storage.setItem(STORAGE_KEY, String(now))
    return last
  } catch {
    return null
  }
}

/**
 * After a deploy, a tab opened earlier still asks for the old build's page chunks, which are
 * gone: Vite reports `vite:preloadError`. Reloading once picks up the new build, instead of the
 * customer seeing "Something went wrong" between scanning the poster and paying.
 */
export function reloadOnStaleBuild(target: Window = window): void {
  target.addEventListener('vite:preloadError', (event) => {
    const now = Date.now()
    const last = swapLastReload(target.sessionStorage, now)
    // Can't remember having tried (storage blocked), or tried a moment ago: never loop.
    if (last === null || now - last < RETRY_WINDOW_MS) return
    event.preventDefault() // handled: don't also throw into the error screen
    target.location.reload()
  })
}
