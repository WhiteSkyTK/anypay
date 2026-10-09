import {
  addMoney,
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  fromMinorUnits,
  type PaymentSummary,
  type ShopPaymentsResponse,
  zeroMoney,
} from '@anypay/shared'
import { randomUUID } from 'node:crypto'
import { AppError } from '../lib/errors'
import type { Logger } from '../lib/logger'
import type { PaymentRecord, PaymentRepository } from '../repositories/payment-repository'
import type { ShopRecord } from '../repositories/shop-repository'
import type { ConsentCallback } from './grant-service'
import type { PaymentEvents } from './payment-events'
import type { PaymentOrchestrator } from './payment-orchestrator'
import type { PaymentSession } from './payment-session'
import type { PaymentWatcher } from './payment-watcher'
import type { ShopService } from './shop-service'

export interface PaymentServiceDeps {
  shops: Pick<ShopService, 'getShop'>
  payments: PaymentRepository
  orchestrator: Pick<PaymentOrchestrator, 'startPayment' | 'finishPayment' | 'declinePayment'>
  watcher: Pick<PaymentWatcher, 'waitForCompletion'>
  events: PaymentEvents
  logger: Logger
  /** How wallets reach this API (the consent callback). */
  publicApiUrl: string
  /** Where the customer lands after approving (the receipt screen). */
  webOrigin: string
}

/** What the customer's wallet appends to our callback URL after the approval screen. */
export interface CallbackQuery {
  interact_ref?: string
  hash?: string
  result?: string
}

export function toSummary(record: PaymentRecord, shopName: string): PaymentSummary {
  return {
    id: record.id,
    shopId: record.shopId,
    shopName,
    status: record.status,
    failure: record.failure,
    amount: record.amount,
    debitAmount: record.debitAmount,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString(),
  }
}

// Spreadsheet apps run cells that start with these as formulas (CSV injection).
const FORMULA_START = /^[=+\-@\t\r]/

function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/**
 * The online payment journey around the orchestrator: stores every step (encrypted), runs the
 * consent callback once, watches the money arrive in the background and publishes each change
 * to the shop's live feed and the customer's receipt.
 */
export class PaymentService {
  readonly #deps: PaymentServiceDeps
  /** Callbacks being handled right now: a double-tapped redirect must not continue a grant twice. */
  readonly #finishing = new Set<string>()

  constructor(deps: PaymentServiceDeps) {
    this.#deps = deps
  }

  /** Steps 1–4 for a customer at a shop: returns the quote and the wallet approval link. */
  async startPayment(
    shopId: string,
    request: CreatePaymentRequest,
  ): Promise<CreatePaymentResponse> {
    const shop = await this.#deps.shops.getShop(shopId)
    const id = randomUUID()
    const session = await this.#deps.orchestrator.startPayment({
      id,
      customerWallet: request.customerWallet,
      merchantWallet: shop.walletAddress,
      amount: request.amount,
      finishUri: `${this.#deps.publicApiUrl}/api/payments/${id}/callback`,
      description: `AnyPay: ${shop.name}`,
    })
    const record = await this.#deps.payments.insert(shop.id, session)
    const payment = this.#publish(record, shop.name)
    const { quote, consent } = session
    return {
      payment,
      quote: quote && {
        debitAmount: quote.debitAmount,
        receiveAmount: quote.receiveAmount,
        expiresAt: quote.expiresAt,
      },
      consentUrl: session.step === 'awaiting-consent' ? consent?.redirectUrl : undefined,
    }
  }

  /**
   * The customer's wallet redirects here after the approval screen. Runs at most once per
   * payment; returns where to send the browser (the receipt), whatever happened.
   */
  async handleCallback(paymentId: string, query: CallbackQuery): Promise<string> {
    const receiptUrl = `${this.#deps.webOrigin}/receipt/${paymentId}`
    const stored = await this.#deps.payments.find(paymentId)
    if (!stored) throw new AppError('payment_not_found', 'No such payment', 404)
    // Single use: a replayed or late callback just shows the receipt.
    if (stored.session.step !== 'awaiting-consent' || this.#finishing.has(paymentId))
      return receiptUrl

    this.#finishing.add(paymentId)
    try {
      const shop = await this.#deps.shops.getShop(stored.record.shopId)
      const session = await this.#finish(stored.session, query)
      await this.#save(session, shop)
      if (session.step === 'sending') void this.#watch(session, shop)
      return receiptUrl
    } finally {
      this.#finishing.delete(paymentId)
    }
  }

  async getPayment(paymentId: string): Promise<PaymentSummary> {
    const stored = await this.#deps.payments.find(paymentId)
    if (!stored) throw new AppError('payment_not_found', 'No such payment', 404)
    const shop = await this.#deps.shops.getShop(stored.record.shopId)
    return toSummary(stored.record, shop.name)
  }

  /** The shop's payments since `since` (e.g. local midnight) and the total actually received. */
  async listForShop(shop: ShopRecord, since: Date): Promise<ShopPaymentsResponse> {
    const records = await this.#deps.payments.listForShop(shop.id, since)
    const total = records
      .filter((record) => record.status === 'completed')
      .reduce(
        (sum, record) => addMoney(sum, record.amount),
        zeroMoney(shop.assetCode, shop.assetScale),
      )
    return { payments: records.map((record) => toSummary(record, shop.name)), total }
  }

  /** Completed payments as CSV, ready for a spreadsheet or the shop's bookkeeper. */
  async csvForShop(shop: ShopRecord, since: Date): Promise<string> {
    const { payments } = await this.listForShop(shop, since)
    const header = [
      'completed_at',
      'amount',
      'currency',
      'customer_paid',
      'customer_currency',
      'payment_id',
    ]
    const rows = payments
      .filter((payment) => payment.status === 'completed')
      .map((payment) => [
        payment.completedAt ?? payment.createdAt,
        fromMinorUnits(payment.amount.value, payment.amount.assetScale),
        payment.amount.assetCode,
        payment.debitAmount
          ? fromMinorUnits(payment.debitAmount.value, payment.debitAmount.assetScale)
          : '',
        payment.debitAmount?.assetCode ?? '',
        payment.id,
      ])
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
  }

  /** After a restart, keeps watching payments that were sent but not yet confirmed. */
  async resumeWatching(): Promise<number> {
    const sessions = await this.#deps.payments.findSessionsByStatus('sending')
    for (const session of sessions) {
      const stored = await this.#deps.payments.find(session.id)
      if (!stored) continue
      const shop = await this.#deps.shops.getShop(stored.record.shopId)
      void this.#watch(session, shop)
    }
    return sessions.length
  }

  #finish(session: PaymentSession, query: CallbackQuery): Promise<PaymentSession> {
    const { interact_ref: interactRef, hash } = query
    // No interact_ref means the customer declined (the wallet sends result=grant_rejected).
    if (!interactRef || !hash)
      return Promise.resolve(this.#deps.orchestrator.declinePayment(session))
    const callback: ConsentCallback = { interactRef, hash }
    return this.#deps.orchestrator.finishPayment(session, callback)
  }

  async #watch(session: PaymentSession, shop: ShopRecord): Promise<void> {
    try {
      const finished = await this.#deps.watcher.waitForCompletion(session)
      await this.#save(finished, shop)
    } catch (error) {
      // Never crash the API over one payment; it stays 'sending' and resumes on restart.
      this.#deps.logger.error({ err: error, paymentId: session.id }, 'Watching a payment failed')
    }
  }

  async #save(session: PaymentSession, shop: ShopRecord): Promise<PaymentSummary> {
    const record = await this.#deps.payments.update(session)
    return this.#publish(record, shop.name)
  }

  #publish(record: PaymentRecord, shopName: string): PaymentSummary {
    const summary = toSummary(record, shopName)
    this.#deps.events.publish(summary)
    return summary
  }
}
