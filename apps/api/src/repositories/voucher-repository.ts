import type { Money, PaymentFailure, PaymentStatus, VoucherRejection } from '@anypay/shared'
import { and, eq, gte, lt } from 'drizzle-orm'
import type { Database } from '../db/database'
import { payments, shops, tabs, vouchers } from '../db/schema'

/** A voucher as stored, with the status of the payment that settles it (if any yet). */
export interface VoucherRecord {
  nonce: string
  tabId: string
  shopId: string
  /** In the shop's currency, as signed. */
  amount: Money
  signedAt: Date
  status: 'settling' | 'rejected'
  reason?: VoucherRejection
  paymentId?: string
  paymentStatus?: PaymentStatus
  paymentFailure?: PaymentFailure
}

export interface NewVoucher {
  nonce: string
  tabId: string
  amount: string
  signedAt: Date
  signature: string
}

/** Vouchers keyed by nonce: the insert that claims a nonce is the "settle at most once" guarantee. */
export class VoucherRepository {
  readonly #db: Database

  constructor(db: Database) {
    this.#db = db
  }

  /**
   * Claims the voucher's nonce. Atomic, so when both phones sync the same voucher at once only
   * one claims it; the other gets the existing voucher (and its status) back.
   */
  async claim(
    voucher: NewVoucher,
    rejection?: VoucherRejection,
  ): Promise<{ claimed: boolean; voucher: VoucherRecord }> {
    const inserted = await this.#db
      .insert(vouchers)
      .values({
        ...voucher,
        amountValue: voucher.amount,
        status: rejection ? 'rejected' : 'settling',
        reason: rejection ?? null,
      })
      .onConflictDoNothing()
      .returning({ nonce: vouchers.nonce })
    const stored = await this.find(voucher.nonce)
    if (!stored) throw new Error(`Voucher ${voucher.nonce} vanished after insert`)
    return { claimed: inserted.length > 0, voucher: stored }
  }

  async attachPayment(nonce: string, paymentId: string): Promise<void> {
    await this.#db.update(vouchers).set({ paymentId }).where(eq(vouchers.nonce, nonce))
  }

  async reject(nonce: string, reason: VoucherRejection): Promise<void> {
    await this.#db
      .update(vouchers)
      .set({ status: 'rejected', reason })
      .where(eq(vouchers.nonce, nonce))
  }

  async find(nonce: string): Promise<VoucherRecord | undefined> {
    const [row] = await this.#select().where(eq(vouchers.nonce, nonce))
    return row && toRecord(row)
  }

  /** A tab's vouchers signed in [from, to): what counts against one week's cap. */
  async listForTab(tabId: string, from: Date, to: Date): Promise<VoucherRecord[]> {
    const rows = await this.#select().where(
      and(eq(vouchers.tabId, tabId), gte(vouchers.signedAt, from), lt(vouchers.signedAt, to)),
    )
    return rows.map(toRecord)
  }

  #select() {
    return this.#db
      .select({
        voucher: vouchers,
        shopId: tabs.shopId,
        assetCode: shops.assetCode,
        assetScale: shops.assetScale,
        paymentStatus: payments.status,
        paymentFailure: payments.failure,
      })
      .from(vouchers)
      .innerJoin(tabs, eq(tabs.id, vouchers.tabId))
      .innerJoin(shops, eq(shops.id, tabs.shopId))
      .leftJoin(payments, eq(payments.id, vouchers.paymentId))
  }
}

type JoinedRow = {
  voucher: typeof vouchers.$inferSelect
  shopId: string
  assetCode: string
  assetScale: number
  paymentStatus: string | null
  paymentFailure: string | null
}

function toRecord(row: JoinedRow): VoucherRecord {
  const { voucher, paymentStatus, paymentFailure } = row
  return {
    nonce: voucher.nonce,
    tabId: voucher.tabId,
    shopId: row.shopId,
    amount: { value: voucher.amountValue, assetCode: row.assetCode, assetScale: row.assetScale },
    signedAt: voucher.signedAt,
    status: voucher.status as VoucherRecord['status'],
    reason: (voucher.reason ?? undefined) as VoucherRejection | undefined,
    paymentId: voucher.paymentId ?? undefined,
    paymentStatus: (paymentStatus ?? undefined) as PaymentStatus | undefined,
    paymentFailure: (paymentFailure ?? undefined) as PaymentFailure | undefined,
  }
}
