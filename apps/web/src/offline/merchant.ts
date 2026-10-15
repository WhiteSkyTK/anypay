import { isFresh, verifyVoucher, type Voucher } from '@anypay/shared'
import { api } from '@/lib/api'
import type { MerchantSession } from '@/lib/merchant-session'
import { markOfflineTabsInUse } from '@/lib/offline-flag'
import { uuid } from '@/lib/uuid'
import { flushOutbox, localRemaining } from './outbox'
import { getDb, type ShopTabRow } from './store'

/**
 * Downloads the shop's active tabs (keys and caps) while there is signal, so vouchers can be
 * checked later with none. Returns how many tabs the shop has.
 */
export async function refreshShopTabs(session: MerchantSession): Promise<number> {
  const { tabs } = await api.shopTabs(session.shopId, session.token)
  const syncedAt = Date.now()
  const db = getDb()
  await db.transaction('rw', db.shopTabs, async () => {
    await db.shopTabs.where('shopId').equals(session.shopId).delete()
    await db.shopTabs.bulkPut(tabs.map((tab) => ({ ...tab, shopId: session.shopId, syncedAt })))
  })
  if (tabs.length > 0) markOfflineTabsInUse()
  return tabs.length
}

export const listShopTabs = (shopId: string) =>
  getDb().shopTabs.where('shopId').equals(shopId).toArray()

/** What is left on a tab right now, counting vouchers this phone took since it last synced. */
export async function remainingOnShopTab(tab: ShopTabRow, at = Date.now()) {
  const outbox = await getDb().outbox.where('tabId').equals(tab.id).toArray()
  return localRemaining(tab, outbox, at)
}

export type VoucherCheck =
  | { ok: true; tab: ShopTabRow }
  | {
      ok: false
      reason: 'other_shop' | 'unknown_tab' | 'invalid' | 'expired' | 'cap_reached' | 'duplicate'
    }

/**
 * The shop's phone checks a scanned voucher with no signal: it is for this shop, from a tab this
 * phone knows, signed by that tab's key, fresh, new, and within what is left of the week's cap.
 */
export async function checkVoucher(
  voucher: Voucher,
  session: MerchantSession,
  now = Date.now(),
): Promise<VoucherCheck> {
  if (voucher.shopId !== session.shopId) return { ok: false, reason: 'other_shop' }
  const tab = await getDb().shopTabs.get(voucher.tabId)
  if (!tab || tab.shopId !== session.shopId) return { ok: false, reason: 'unknown_tab' }
  if (!(await verifyVoucher(tab.publicKey, voucher))) return { ok: false, reason: 'invalid' }
  if (!isFresh(voucher.ts, now)) return { ok: false, reason: 'expired' }
  if (await getDb().outbox.get(voucher.nonce)) return { ok: false, reason: 'duplicate' }
  const remaining = await remainingOnShopTab(tab, voucher.ts * 1000)
  if (BigInt(voucher.amount) > BigInt(remaining.value)) return { ok: false, reason: 'cap_reached' }
  return { ok: true, tab }
}

/** Keeps an accepted voucher in the outbox: "Saved – settles when online". */
export async function acceptVoucher(voucher: Voucher, tab: ShopTabRow): Promise<void> {
  await getDb().outbox.put({
    ...voucher,
    amount: { ...tab.shopCap, value: voucher.amount },
    role: 'merchant',
    state: 'saved',
    idempotencyKey: uuid(),
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: Date.now(),
  })
  markOfflineTabsInUse()
  void flushOutbox()
}

/** The shop's vouchers on this phone, newest first, for the feed's "waiting to settle" list. */
export async function listShopOutbox(shopId: string) {
  const rows = await getDb().outbox.where('role').equals('merchant').toArray()
  return rows.filter((row) => row.shopId === shopId).sort((a, b) => b.createdAt - a.createdAt)
}
