import { getMerchantSession } from '@/lib/merchant-session'
import { refreshMyTabs } from './customer'
import { refreshShopTabs } from './merchant'
import { ensureSync } from './outbox'

/** After each flush: bring this phone's tabs (and its shop's tabs, if it runs one) up to date. */
async function refreshAll(): Promise<void> {
  await refreshMyTabs()
  const session = getMerchantSession()
  if (session) await refreshShopTabs(session).catch(() => undefined)
}

/** Keeps vouchers moving and figures fresh for as long as the app is open. */
export function startOfflineSync(): void {
  ensureSync(refreshAll)
}
