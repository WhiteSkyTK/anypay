import type { Money, ShopTab, TabSummary, VoucherRejection } from '@anypay/shared'
import { Dexie, type EntityTable } from 'dexie'

/** The customer's device key for one tab. The private half can't be exported, only used. */
export interface DeviceKeyRow {
  tabId: string
  privateKey: CryptoKey
  publicKey: CryptoKey
}

/** A customer's tab as last seen online. */
export interface MyTabRow extends TabSummary {
  /** When this phone last heard from the server about it (ms). */
  syncedAt: number
}

/** A tab at this phone's shop: what it needs to check vouchers with no signal. */
export interface ShopTabRow extends ShopTab {
  shopId: string
  syncedAt: number
}

/** Saved offline → Sending → Settled | Failed (CLAUDE.md per-item states). */
export type OutboxState = 'saved' | 'sending' | 'settled' | 'failed'

export type OutboxFailure = VoucherRejection | 'invalid'

/** A voucher waiting to reach the server, kept on both phones. Keyed by nonce: one per sale. */
export interface OutboxRow {
  nonce: string
  /** Which side of the sale this phone was. */
  role: 'customer' | 'merchant'
  tabId: string
  shopId: string
  amount: Money
  ts: number
  signature: string
  state: OutboxState
  reason?: OutboxFailure
  paymentId?: string
  /** The client UUID sent as Idempotency-Key, so a retried send can't settle twice. */
  idempotencyKey: string
  attempts: number
  nextAttemptAt: number
  createdAt: number
  /** When the server first took the voucher; until then it doesn't count in synced caps. */
  ackedAt?: number
}

/** Everything AnyPay keeps on the phone for offline use (IndexedDB via Dexie). */
export class AnyPayDb extends Dexie {
  keys!: EntityTable<DeviceKeyRow, 'tabId'>
  myTabs!: EntityTable<MyTabRow, 'id'>
  shopTabs!: EntityTable<ShopTabRow, 'id'>
  outbox!: EntityTable<OutboxRow, 'nonce'>

  constructor(name = 'anypay') {
    super(name)
    this.version(1).stores({
      keys: 'tabId',
      myTabs: 'id, shopId',
      shopTabs: 'id, shopId',
      outbox: 'nonce, role, tabId, state',
    })
  }
}

let current: AnyPayDb | undefined

/** The phone's database, opened on first use. */
export function getDb(): AnyPayDb {
  current ??= new AnyPayDb()
  return current
}

/** Tests: a fresh, empty database. */
export async function resetDb(): Promise<AnyPayDb> {
  await current?.delete()
  current = new AnyPayDb()
  return current
}
