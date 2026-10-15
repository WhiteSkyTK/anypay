import {
  type DeviceKeys,
  type SaleRequest,
  signVoucher,
  type TabSummary,
  type Voucher,
} from '@anypay/shared'
import { api } from '@/lib/api'
import { markOfflineTabsInUse } from '@/lib/offline-flag'
import { uuid } from '@/lib/uuid'
import { flushOutbox, localRemaining } from './outbox'
import { getDb, type MyTabRow } from './store'

/** Keeps the tab's device key on this phone; vouchers for this tab can only be signed here. */
export async function saveTabKeys(tabId: string, keys: DeviceKeys): Promise<void> {
  await getDb().keys.put({ tabId, ...keys })
  markOfflineTabsInUse()
}

export async function rememberTab(tab: TabSummary): Promise<MyTabRow> {
  const row = { ...tab, syncedAt: Date.now() }
  await getDb().myTabs.put(row)
  return row
}

export const listMyTabs = () => getDb().myTabs.toArray()

export async function hasKeyFor(tabId: string): Promise<boolean> {
  return (await getDb().keys.get(tabId)) !== undefined
}

/** This phone's usable tab at a shop: active, and its key is on this phone. */
export async function myTabAtShop(shopId: string): Promise<MyTabRow | undefined> {
  const tabs = await getDb().myTabs.where('shopId').equals(shopId).toArray()
  for (const tab of tabs) {
    if (tab.status === 'active' && (await hasKeyFor(tab.id))) return tab
  }
  return undefined
}

/** What is left on a tab right now, counting vouchers this phone signed since it last synced. */
export async function remainingOn(tab: MyTabRow, at = Date.now()) {
  if (!tab.shopCap || !tab.remaining) return undefined
  const outbox = await getDb().outbox.where('tabId').equals(tab.id).toArray()
  return localRemaining(
    {
      shopCap: tab.shopCap,
      remaining: tab.remaining,
      weekStartedAt: tab.weekStartedAt,
      syncedAt: tab.syncedAt,
    },
    outbox,
    at,
  )
}

/** Brings this phone's tabs up to date when there is signal; offline, they stay as they were. */
export async function refreshMyTabs(): Promise<void> {
  for (const tab of await listMyTabs()) {
    try {
      await rememberTab(await api.getTab(tab.id))
    } catch {
      // No signal or the server is asleep: keep the last known figures.
    }
  }
}

export type ApproveResult =
  { ok: true; voucher: Voucher } | { ok: false; reason: 'no_tab' | 'cap_reached' }

/**
 * The customer approves a shop's sale request, offline: signs the voucher with this phone's key
 * and keeps it in the outbox until either phone gets it to the server.
 */
export async function approveSale(request: SaleRequest): Promise<ApproveResult> {
  const tab = await myTabAtShop(request.shopId)
  const key = tab && (await getDb().keys.get(tab.id))
  // Without the cap in the shop's currency neither phone could check the sale offline.
  if (!tab?.shopCap || !key) return { ok: false, reason: 'no_tab' }
  const remaining = await remainingOn(tab, request.ts * 1000)
  if (remaining && BigInt(request.amount) > BigInt(remaining.value))
    return { ok: false, reason: 'cap_reached' }

  const voucher = await signVoucher(key.privateKey, { ...request, tabId: tab.id })
  await getDb().outbox.put({
    ...voucher,
    amount: { ...tab.shopCap, value: request.amount },
    role: 'customer',
    state: 'saved',
    idempotencyKey: uuid(),
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: Date.now(),
  })
  void flushOutbox()
  return { ok: true, voucher }
}
