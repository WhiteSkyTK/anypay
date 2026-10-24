// The service worker precaches only what customers need (pwa-precache.ts). Phones that must work
// with no signal fetch the rest once, in the background, while they still have signal: a shop's
// phone its own screens, a customer with a tab the tab screens. Loading a screen's code puts it in
// the service worker's cache, so it opens offline later.

type Importer = () => Promise<unknown>

export const SCREENS: Record<'shop' | 'tab', Importer[]> = {
  shop: [
    () => import('@/pages/MerchantPage'),
    () => import('@/pages/TabSalePage'),
    () => import('@/pages/ReceiveVoucherPage'),
    () => import('@/pages/ScanPage'),
    () => import('@/pages/PosterPage'),
    () => import('@/pages/SettingsPage'),
    () => import('@/pages/ShopPhonesPage'),
    () => import('@/offline'),
  ],
  tab: [
    () => import('@/pages/TabPage'),
    () => import('@/pages/TabDetailPage'),
    () => import('@/pages/ApproveSalePage'),
    () => import('@/pages/ScanPage'),
    () => import('@/offline'),
  ],
}

const warmed = new Set<keyof typeof SCREENS>()

/** Fetches a kind of phone's screens once per visit, when the browser is idle. Never throws. */
export function warmScreens(kind: keyof typeof SCREENS, screens = SCREENS): void {
  if (warmed.has(kind)) return
  warmed.add(kind)
  const run = () => void Promise.allSettled(screens[kind].map((load) => load()))
  if ('requestIdleCallback' in globalThis) requestIdleCallback(run, { timeout: 5000 })
  else setTimeout(run, 2000)
}
