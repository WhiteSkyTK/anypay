import { NotImplementedError } from '../lib/errors'

/**
 * Offline Digital Tab (Feature 4): tabs, device public keys, voucher verification, settlement.
 * A tab is an interval-capped outgoing-payment grant, so offline sales are pre-authorised but
 * the merchant's risk is bounded by the customer's weekly cap.
 *
 * Phase 3: implement.
 */
export class TabService {
  /** Stores the customer's tab grant and registers their device's public key. */
  async openTab(): Promise<never> {
    throw new NotImplementedError('TabService.openTab')
  }

  /** Verifies a signed voucher (signature, unused nonce, age, cap) and settles it once. */
  async settleVoucher(): Promise<never> {
    throw new NotImplementedError('TabService.settleVoucher')
  }
}
