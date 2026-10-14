import type { Money, PublicKeyJwk, TabFailure, TabStatus } from '@anypay/shared'
import { and, eq } from 'drizzle-orm'
import type { Database } from '../db/database'
import { shops, tabs } from '../db/schema'
import type { TokenCipher } from '../lib/token-cipher'
import type { GrantedAccess, WalletAddressInfo } from '../open-payments/types'
import type { ConsentRequest } from '../services/grant-service'

/** What only the server may read: the customer's wallet and the grant. Stored encrypted. */
export interface TabSession {
  customer: WalletAddressInfo
  consent?: ConsentRequest
  /** The approved weekly-capped grant: settles vouchers with no customer interaction. */
  access?: GrantedAccess
}

/** The plain-text columns: enough to list tabs and check vouchers without decrypting. */
export interface TabRecord {
  id: string
  shopId: string
  status: TabStatus
  failure?: TabFailure
  label: string
  /** The weekly cap the customer approved, in their currency. */
  cap: Money
  /** The same cap in the shop's currency, once known. */
  shopCap?: Money
  intervalStart: Date
  publicKey: PublicKeyJwk
  createdAt: Date
}

export type NewTab = Pick<
  TabRecord,
  'id' | 'shopId' | 'label' | 'cap' | 'intervalStart' | 'publicKey'
>

type TabRow = typeof tabs.$inferSelect
type ShopAsset = { assetCode: string; assetScale: number }

function toRecord(row: TabRow, shop: ShopAsset): TabRecord {
  return {
    id: row.id,
    shopId: row.shopId,
    status: row.status as TabStatus,
    failure: (row.failure ?? undefined) as TabFailure | undefined,
    label: row.label,
    cap: { value: row.capValue, assetCode: row.capAssetCode, assetScale: row.capAssetScale },
    shopCap:
      row.shopCapValue === null
        ? undefined
        : { value: row.shopCapValue, assetCode: shop.assetCode, assetScale: shop.assetScale },
    intervalStart: row.intervalStart,
    publicKey: row.publicKey as PublicKeyJwk,
    createdAt: row.createdAt,
  }
}

/** Customers' tabs. The grant (tokens) and the customer's wallet are only ever stored encrypted. */
export class TabRepository {
  readonly #db: Database
  readonly #cipher: TokenCipher
  readonly #now: () => Date

  constructor(db: Database, cipher: TokenCipher, now: () => Date = () => new Date()) {
    this.#db = db
    this.#cipher = cipher
    this.#now = now
  }

  async insert(tab: NewTab, session: TabSession): Promise<void> {
    await this.#db.insert(tabs).values({
      id: tab.id,
      shopId: tab.shopId,
      status: 'awaiting-consent',
      label: tab.label,
      capValue: tab.cap.value,
      capAssetCode: tab.cap.assetCode,
      capAssetScale: tab.cap.assetScale,
      intervalStart: tab.intervalStart,
      publicKey: tab.publicKey,
      sessionCiphertext: this.#seal(session),
    })
  }

  async update(
    id: string,
    changes: { status?: TabStatus; failure?: TabFailure; shopCap?: Money; session?: TabSession },
  ): Promise<void> {
    await this.#db
      .update(tabs)
      .set({
        status: changes.status,
        failure: changes.failure,
        shopCapValue: changes.shopCap?.value,
        sessionCiphertext: changes.session && this.#seal(changes.session),
        updatedAt: this.#now(),
      })
      .where(eq(tabs.id, id))
  }

  async find(id: string): Promise<{ record: TabRecord; session: TabSession } | undefined> {
    const [row] = await this.#db
      .select({ tab: tabs, assetCode: shops.assetCode, assetScale: shops.assetScale })
      .from(tabs)
      .innerJoin(shops, eq(shops.id, tabs.shopId))
      .where(eq(tabs.id, id))
    if (!row) return undefined
    const session = JSON.parse(this.#cipher.decrypt(row.tab.sessionCiphertext)) as TabSession
    return { record: toRecord(row.tab, row), session }
  }

  async listActiveForShop(shopId: string): Promise<TabRecord[]> {
    const rows = await this.#db
      .select({ tab: tabs, assetCode: shops.assetCode, assetScale: shops.assetScale })
      .from(tabs)
      .innerJoin(shops, eq(shops.id, tabs.shopId))
      .where(and(eq(tabs.shopId, shopId), eq(tabs.status, 'active')))
    return rows.map((row) => toRecord(row.tab, row))
  }

  #seal(session: TabSession): string {
    return this.#cipher.encrypt(JSON.stringify(session))
  }
}
