import { NotImplementedError } from '../lib/errors'

/**
 * Runs the online payment flow (CLAUDE.md steps 1–5) as an explicit state machine, so every
 * failure (consent declined, quote expired, insufficient funds) maps to one clear UI state.
 *
 * Phase 1: implement with the gateway, grant service and wallet address resolver injected.
 */
export class PaymentOrchestrator {
  /** Steps 1–4: incoming payment, quote, then the interactive grant the customer must approve. */
  async startPayment(): Promise<never> {
    throw new NotImplementedError('PaymentOrchestrator.startPayment')
  }

  /** Step 4–5: verify the callback hash, continue the grant and create the outgoing payment. */
  async finishPayment(): Promise<never> {
    throw new NotImplementedError('PaymentOrchestrator.finishPayment')
  }
}
