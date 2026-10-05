import { toMinorUnits, type Money } from '@anypay/shared'
import { randomUUID } from 'node:crypto'
import { AppError } from '../lib/errors'
import { type OpenPaymentsErrorCode, isOpenPaymentsError } from '../open-payments/errors'
import type { OpenPaymentsPort } from '../open-payments/port'
import type { ConsentCallback, GrantService } from './grant-service'
import {
  advance,
  assertStep,
  fail,
  type PaymentFailure,
  type PaymentSession,
} from './payment-session'
import type { WalletAddressResolver } from './wallet-address-resolver'

type PaymentPort = Pick<
  OpenPaymentsPort,
  'createIncomingPayment' | 'createQuote' | 'createOutgoingPayment'
>

export interface PaymentOrchestratorDeps {
  openPayments: PaymentPort
  grants: Pick<
    GrantService,
    | 'requestIncomingPaymentAccess'
    | 'requestQuoteAccess'
    | 'requestPaymentConsent'
    | 'completeConsent'
  >
  wallets: Pick<WalletAddressResolver, 'resolve'>
  now?: () => Date
  /** Called after every step, e.g. to log progress or (Phase 2) push it to the merchant. */
  onStep?: (session: PaymentSession) => void
}

export interface StartPaymentInput {
  customerWallet: string
  merchantWallet: string
  /** Decimal amount as typed ('25' or '25.00'), in the shop's currency. */
  amount: string
  /** Our consent callback URL; omit to poll instead (CLI fallback). */
  finishUri?: string
  description?: string
}

/** How long the shop's payment request stays open. */
const INCOMING_PAYMENT_TTL_MS = 10 * 60 * 1000

// Errors that are an expected end of a payment, not a bug: they become a failed session.
const FAILURE_BY_ERROR: Partial<Record<OpenPaymentsErrorCode, PaymentFailure>> = {
  consent_declined: 'consent_declined',
  consent_invalid: 'consent_invalid',
  consent_pending: 'consent_timeout',
  quote_expired: 'quote_expired',
  grant_limit: 'grant_limit',
}

/**
 * Runs the online payment flow (CLAUDE.md steps 1–5) as an explicit state machine:
 * created → incoming-payment-created → quoted → awaiting-consent → sending → completed | failed.
 * Expected failures (declined consent, expired quote, limits) end in a `failed` session with a
 * reason the UI can show; anything unexpected is thrown.
 */
export class PaymentOrchestrator {
  readonly #deps: PaymentOrchestratorDeps
  readonly #now: () => Date

  constructor(deps: PaymentOrchestratorDeps) {
    this.#deps = deps
    this.#now = deps.now ?? (() => new Date())
  }

  /**
   * Steps 1–4: resolve both wallets, create the shop's incoming payment, quote it from the
   * customer's wallet, and ask the customer's wallet for consent. The returned session holds the
   * consent link (`session.consent.redirectUrl`).
   */
  async startPayment(input: StartPaymentInput): Promise<PaymentSession> {
    const { wallets } = this.#deps
    const [customer, merchant] = await Promise.all([
      wallets.resolve(input.customerWallet),
      wallets.resolve(input.merchantWallet),
    ])
    const amount = this.#toShopAmount(input.amount, merchant)
    const session: PaymentSession = {
      id: randomUUID(),
      step: 'created',
      customer,
      merchant,
      amount,
      description: input.description,
    }
    // `latest` keeps whatever was created before a failure, so the failed session shows it.
    let latest = this.#step(session)
    try {
      latest = await this.#createIncomingPayment(latest)
      latest = await this.#createQuote(latest)
      return await this.#requestConsent(latest, input.finishUri)
    } catch (error) {
      return this.#failOrThrow(latest, error)
    }
  }

  /**
   * Step 4–5, after the customer comes back: verify the callback, continue the grant and create
   * the outgoing payment. The PaymentWatcher then waits for the money to arrive.
   */
  async finishPayment(
    session: PaymentSession,
    callback?: ConsentCallback,
  ): Promise<PaymentSession> {
    assertStep(session, 'awaiting-consent')
    const { quote, consent, customer } = session
    if (!quote || !consent) throw new AppError('invalid_payment_step', 'Payment was never quoted')
    // An expired quote can't be paid, so there's no point continuing the grant.
    if (quote.expiresAt && new Date(quote.expiresAt) <= this.#now()) {
      return this.#step(fail(session, 'quote_expired'))
    }
    try {
      const outgoingAccess = await this.#deps.grants.completeConsent(consent, callback)
      const outgoingPayment = await this.#deps.openPayments.createOutgoingPayment(
        customer.resourceServer,
        outgoingAccess.accessToken.value,
        { walletAddress: customer.id, quoteId: quote.id, metadata: this.#metadata(session) },
      )
      return this.#step(advance(session, 'sending', { outgoingAccess, outgoingPayment }))
    } catch (error) {
      return this.#failOrThrow(session, error)
    }
  }

  /** The customer pressed "decline" in their wallet (callback `result=grant_rejected`). */
  declinePayment(session: PaymentSession): PaymentSession {
    assertStep(session, 'awaiting-consent')
    return this.#step(fail(session, 'consent_declined'))
  }

  async #createIncomingPayment(session: PaymentSession): Promise<PaymentSession> {
    const { merchant, amount } = session
    const incomingAccess = await this.#deps.grants.requestIncomingPaymentAccess(merchant)
    const incomingPayment = await this.#deps.openPayments.createIncomingPayment(
      merchant.resourceServer,
      incomingAccess.accessToken.value,
      {
        walletAddress: merchant.id,
        incomingAmount: amount,
        expiresAt: new Date(this.#now().getTime() + INCOMING_PAYMENT_TTL_MS).toISOString(),
        metadata: this.#metadata(session),
      },
    )
    return this.#step(
      advance(session, 'incoming-payment-created', { incomingAccess, incomingPayment }),
    )
  }

  async #createQuote(session: PaymentSession): Promise<PaymentSession> {
    const { customer, incomingPayment } = session
    if (!incomingPayment) throw new AppError('invalid_payment_step', 'No incoming payment to quote')
    const quoteAccess = await this.#deps.grants.requestQuoteAccess(customer)
    const quote = await this.#deps.openPayments.createQuote(
      customer.resourceServer,
      quoteAccess.accessToken.value,
      { walletAddress: customer.id, receiver: incomingPayment.id },
    )
    return this.#step(advance(session, 'quoted', { quote }))
  }

  async #requestConsent(session: PaymentSession, finishUri?: string): Promise<PaymentSession> {
    const { customer, quote } = session
    if (!quote) throw new AppError('invalid_payment_step', 'No quote to approve')
    // The grant is capped at exactly what the quote debits, so it can't be reused for more.
    const consent = await this.#deps.grants.requestPaymentConsent(customer, {
      debitAmount: quote.debitAmount,
      finishUri,
    })
    return this.#step(advance(session, 'awaiting-consent', { consent }))
  }

  /** An expected Open Payments failure ends the session with a reason; anything else is a bug. */
  #failOrThrow(session: PaymentSession, error: unknown): PaymentSession {
    const failure = isOpenPaymentsError(error) ? FAILURE_BY_ERROR[error.code] : undefined
    if (!failure) throw error
    return this.#step(fail(session, failure))
  }

  #step(session: PaymentSession): PaymentSession {
    this.#deps.onStep?.(session)
    return session
  }

  #toShopAmount(amount: string, merchant: { assetCode: string; assetScale: number }): Money {
    const value = toMinorUnits(amount, merchant.assetScale)
    if (value === '0') throw new AppError('invalid_amount', 'The amount must be more than zero')
    return { value, assetCode: merchant.assetCode, assetScale: merchant.assetScale }
  }

  #metadata(session: PaymentSession): Record<string, unknown> {
    // Shown in both wallets' transaction lists, so the payment is recognisable as AnyPay's.
    return { description: session.description ?? 'AnyPay payment', anypayPaymentId: session.id }
  }
}
