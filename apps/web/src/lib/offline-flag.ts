const STORAGE_KEY = 'anypay.offlineTabs'

/**
 * Whether this phone uses the Offline Digital Tab (opened a tab, or runs a shop with tabs). Only
 * then does the app load the offline store and keep syncing in the background: a customer who
 * only ever scans and pays never downloads it (prepaid data).
 */
export function usesOfflineTabs(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function markOfflineTabsInUse(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'on')
  } catch {
    // Storage blocked: sync then starts only while a tab screen is open.
  }
}

/** The offline store (Dexie, ~30 KB) as its own chunk, loaded only when a screen needs it. */
export const loadOffline = () => import('@/offline')
