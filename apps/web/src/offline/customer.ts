import {
  type DeviceKeys,
  type SaleRequest,
  signVoucher,
  type TabSummary,
  type Voucher,
} from '@anypay/shared'
import { api } from '@/lib/api'
import { markOfflineTabsInUse } from '@/lib/offline-flag'
import { serverNow } from '@/lib/server-clock'
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
  const usable = await Promise.all(
    tabs
      .filter((tab) => tab.status === 'active')
      .map(async (tab) => ({
        tab,
        signable: await hasKeyFor(tab.id),
        left: BigInt((await remainingOn(tab))?.value ?? '0'),
      })),
  )
  // A customer who opened a new tab after using up the old one sells on the one with room.
  let best: (typeof usable)[number] | undefined
  for (const candidate of usable) {
    if (candidate.signable && (!best || candidate.left > best.left)) best = candidate
  }
  return best?.tab
}

/** What is left on a tab right now, counting vouchers this phone signed since it last synced. */
export async function remainingOn(tab: MyTabRow, at = serverNow()) {
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
  const tabs = await listMyTabs()
  // No signal or the server asleep: that tab keeps its last known figures.
  await Promise.allSettled(tabs.map(async (tab) => rememberTab(await api.getTab(tab.id))))
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
