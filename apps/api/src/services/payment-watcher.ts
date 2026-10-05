import { NotImplementedError } from '../lib/errors'

/**
 * Polls an incoming payment until it completes, then emits an event that the merchant's live
 * feed receives over SSE. The server polls so that phones never have to (low data).
 *
 * Phase 1–2: implement.
 */
export class PaymentWatcher {
  /** Starts watching one incoming payment. */
  async watch(): Promise<never> {
    throw new NotImplementedError('PaymentWatcher.watch')
  }
}
