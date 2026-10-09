import type { Money, PaymentFailure, PaymentStatus } from '@anypay/shared'
import { and, desc, eq, gte } from 'drizzle-orm'
import type { Database } from '../db/database'
import { payments } from '../db/schema'
import type { TokenCipher } from '../lib/token-cipher'
import type { PaymentSession } from '../services/payment-session'

/** The plain-text columns: enough for feeds, totals and receipts without decrypting anything. */
export interface PaymentRecord {
  id: string
  shopId: string
  status: PaymentStatus
  failure?: PaymentFailure
  amount: Money
  debitAmount?: Money
  createdAt: Date
  completedAt?: Date
}

type PaymentRow = typeof payments.$inferSelect

function toRecord(row: PaymentRow): PaymentRecord {
  const debitAmount =
    row.debitValue !== null && row.debitAssetCode !== null && row.debitAssetScale !== null
      ? { value: row.debitValue, assetCode: row.debitAssetCode, assetScale: row.debitAssetScale }
      : undefined
  return {
    id: row.id,
    shopId: row.shopId,
    status: row.status as PaymentStatus,
    failure: (row.failure ?? undefined) as PaymentFailure | undefined,
    amount: { value: row.amountValue, assetCode: row.assetCode, assetScale: row.assetScale },
    debitAmount,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
  }
}

/**
 * Stores payment sessions. The full session (grant tokens, the customer's wallet) is only ever
 * written encrypted; the columns beside it hold just what lists and totals need.
 */
export class PaymentRepository {
  readonly #db: Database
  readonly #cipher: TokenCipher
  readonly #now: () => Date

  constructor(db: Database, cipher: TokenCipher, now: () => Date = () => new Date()) {
    this.#db = db
    this.#cipher = cipher
    this.#now = now
  }

  async insert(shopId: string, session: PaymentSession): Promise<PaymentRecord> {
    const [row] = await this.#db
      .insert(payments)
      .values({ id: session.id, shopId, ...this.#columns(session) })
      .returning()
    if (!row) throw new Error('Payment insert returned no row')
    return toRecord(row)
  }

  async update(session: PaymentSession): Promise<PaymentRecord> {
    const [row] = await this.#db
      .update(payments)
      .set({ ...this.#columns(session), updatedAt: this.#now() })
      .where(eq(payments.id, session.id))
      .returning()
    if (!row) throw new Error(`No payment ${session.id} to update`)
    return toRecord(row)
  }

  async find(id: string): Promise<{ record: PaymentRecord; session: PaymentSession } | undefined> {
    const [row] = await this.#db.select().from(payments).where(eq(payments.id, id))
    if (!row) return undefined
    const session = JSON.parse(this.#cipher.decrypt(row.sessionCiphertext)) as PaymentSession
    return { record: toRecord(row), session }
  }

  /** A shop's payments since a moment (e.g. local midnight), newest first. */
  async listForShop(shopId: string, since: Date): Promise<PaymentRecord[]> {
    const rows = await this.#db
      .select()
      .from(payments)
      .where(and(eq(payments.shopId, shopId), gte(payments.createdAt, since)))
      .orderBy(desc(payments.createdAt))
    return rows.map(toRecord)
  }

  /** Sessions in a given step, e.g. 'sending' ones to resume watching after a restart. */
  async findSessionsByStatus(status: PaymentStatus): Promise<PaymentSession[]> {
    const rows = await this.#db.select().from(payments).where(eq(payments.status, status))
    return rows.map(
      (row) => JSON.parse(this.#cipher.decrypt(row.sessionCiphertext)) as PaymentSession,
    )
  }

  #columns(session: PaymentSession) {
    const debit = session.quote?.debitAmount
    return {
      status: session.step,
      failure: session.failure ?? null,
      amountValue: session.amount.value,
      assetCode: session.amount.assetCode,
      assetScale: session.amount.assetScale,
      debitValue: debit?.value ?? null,
      debitAssetCode: debit?.assetCode ?? null,
      debitAssetScale: debit?.assetScale ?? null,
      sessionCiphertext: this.#cipher.encrypt(JSON.stringify(session)),
      completedAt: session.step === 'completed' ? this.#now() : null,
    }
  }
}
