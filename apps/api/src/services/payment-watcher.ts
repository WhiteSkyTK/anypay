import { compareMoney } from '@anypay/shared'
import { AppError } from '../lib/errors'
import type { OpenPaymentsPort } from '../open-payments/port'
import type { IncomingPaymentInfo, OutgoingPaymentInfo } from '../open-payments/types'
import { advance, assertStep, fail, type PaymentSession } from './payment-session'

type WatchPort = Pick<OpenPaymentsPort, 'getIncomingPayment' | 'getOutgoingPayment'>

export interface PaymentWatcherOptions {
  /** First wait between polls; grows ×1.5 up to maxIntervalMs. */
  intervalMs?: number
  maxIntervalMs?: number
  /** Give up after this long and report a timeout. */
  timeoutMs?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function isFullyPaid(incoming: IncomingPaymentInfo): boolean {
  if (incoming.completed) return true
  return (
    incoming.incomingAmount !== undefined &&
    compareMoney(incoming.receivedAmount, incoming.incomingAmount) >= 0
  )
}

/**
 * The wallet funds an outgoing payment after it is created, so a customer without enough money
 * only shows up later, as a failed payment that sent nothing.
 */
function failureOf(outgoing: OutgoingPaymentInfo) {
  return outgoing.sentAmount.value === '0' ? 'insufficient_funds' : 'payment_failed'
}

/**
 * Polls a sent payment until the shop's incoming payment is fully paid, or the customer's
 * outgoing payment fails. The server polls, so phones never have to (low data); Phase 2 pushes
 * the result to the merchant over SSE.
 */
export class PaymentWatcher {
  readonly #openPayments: WatchPort
  readonly #intervalMs: number
  readonly #maxIntervalMs: number
  readonly #timeoutMs: number
  readonly #sleep: (ms: number) => Promise<void>
  readonly #now: () => number

  constructor(openPayments: WatchPort, options: PaymentWatcherOptions = {}) {
    this.#openPayments = openPayments
    this.#intervalMs = options.intervalMs ?? 1000
    this.#maxIntervalMs = options.maxIntervalMs ?? 5000
    this.#timeoutMs = options.timeoutMs ?? 120_000
    this.#sleep = options.sleep ?? realSleep
    this.#now = options.now ?? Date.now
  }

  /** Resolves with a `completed` or `failed` session; never leaves it at `sending`. */
  async waitForCompletion(session: PaymentSession): Promise<PaymentSession> {
    assertStep(session, 'sending')
    const { outgoingPayment, outgoingAccess, incomingPayment, incomingAccess } = session
    if (!outgoingPayment || !outgoingAccess || !incomingPayment || !incomingAccess) {
      throw new AppError('invalid_payment_step', 'Nothing to watch: the payment was never sent')
    }
    const deadline = this.#now() + this.#timeoutMs
    let delay = this.#intervalMs

    while (this.#now() < deadline) {
      const outgoing = await this.#openPayments.getOutgoingPayment(
        outgoingPayment.id,
        outgoingAccess.accessToken.value,
      )
      if (outgoing.failed) {
        return advance(session, 'failed', {
          outgoingPayment: outgoing,
          failure: failureOf(outgoing),
        })
      }
      const incoming = await this.#openPayments.getIncomingPayment(
        incomingPayment.id,
        incomingAccess.accessToken.value,
      )
      if (isFullyPaid(incoming)) {
        return advance(session, 'completed', {
          outgoingPayment: outgoing,
          incomingPayment: incoming,
        })
      }
      await this.#sleep(delay)
      delay = Math.min(Math.round(delay * 1.5), this.#maxIntervalMs)
    }
    return fail(session, 'timeout')
  }
}
