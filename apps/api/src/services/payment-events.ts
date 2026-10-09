import type { PaymentSummary } from '@anypay/shared'
import { EventEmitter } from 'node:events'

type Listener = (payment: PaymentSummary) => void

/**
 * In-process pub/sub for payment changes: the shop's live feed and the customer's receipt
 * subscribe over SSE. One API instance is enough for the pilot; several instances would swap
 * this for Postgres LISTEN/NOTIFY without changing the subscribers.
 */
export class PaymentEvents {
  readonly #emitter = new EventEmitter()

  constructor() {
    // Every open feed or receipt is a listener; the default warning at 10 is meant for leaks.
    this.#emitter.setMaxListeners(0)
  }

  publish(payment: PaymentSummary): void {
    this.#emitter.emit(`shop:${payment.shopId}`, payment)
    this.#emitter.emit(`payment:${payment.id}`, payment)
  }

  /** Every change to a shop's payments. Returns the unsubscribe function. */
  onShop(shopId: string, listener: Listener): () => void {
    return this.#subscribe(`shop:${shopId}`, listener)
  }

  /** Every change to one payment (the customer's receipt). */
  onPayment(paymentId: string, listener: Listener): () => void {
    return this.#subscribe(`payment:${paymentId}`, listener)
  }

  #subscribe(channel: string, listener: Listener): () => void {
    this.#emitter.on(channel, listener)
    return () => this.#emitter.off(channel, listener)
  }
}
