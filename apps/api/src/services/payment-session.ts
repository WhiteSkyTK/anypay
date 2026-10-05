import type { Money } from '@anypay/shared'
import { AppError } from '../lib/errors'
import type {
  GrantedAccess,
  IncomingPaymentInfo,
  OutgoingPaymentInfo,
  QuoteInfo,
  WalletAddressInfo,
} from '../open-payments/types'
import type { ConsentRequest } from './grant-service'

/** The online payment flow as an explicit state machine (CLAUDE.md steps 1–5). */
export type PaymentStep =
  | 'created'
  | 'incoming-payment-created'
  | 'quoted'
  | 'awaiting-consent'
  | 'sending'
  | 'completed'
  | 'failed'

/** Every way a payment can fail, each with its own message in the UI. */
export type PaymentFailure =
  | 'consent_declined'
  | 'consent_invalid'
  | 'consent_timeout'
  | 'quote_expired'
  | 'insufficient_funds'
  | 'grant_limit'
  | 'payment_failed'
  | 'timeout'

const TRANSITIONS: Record<PaymentStep, readonly PaymentStep[]> = {
  created: ['incoming-payment-created', 'failed'],
  'incoming-payment-created': ['quoted', 'failed'],
  quoted: ['awaiting-consent', 'failed'],
  'awaiting-consent': ['sending', 'failed'],
  sending: ['completed', 'failed'],
  completed: [],
  failed: [],
}

/**
 * One payment from the shop's request to the money arriving. Holds grant tokens, so it must never
 * be logged or sent to a browser whole; Phase 2 stores it encrypted.
 */
export interface PaymentSession {
  id: string
  step: PaymentStep
  failure?: PaymentFailure
  customer: WalletAddressInfo
  merchant: WalletAddressInfo
  /** What the shop asked for, in the shop's own asset. */
  amount: Money
  description?: string
  incomingPayment?: IncomingPaymentInfo
  incomingAccess?: GrantedAccess
  quote?: QuoteInfo
  consent?: ConsentRequest
  outgoingAccess?: GrantedAccess
  outgoingPayment?: OutgoingPaymentInfo
}

export function canTransition(from: PaymentStep, to: PaymentStep): boolean {
  return TRANSITIONS[from].includes(to)
}

/** Moves a session to its next step, refusing any move the flow doesn't allow. */
export function advance(
  session: PaymentSession,
  to: PaymentStep,
  changes: Partial<Omit<PaymentSession, 'id' | 'step'>> = {},
): PaymentSession {
  if (!canTransition(session.step, to)) {
    throw new AppError('invalid_payment_step', `A ${session.step} payment cannot become ${to}`, 409)
  }
  return { ...session, ...changes, step: to }
}

export function fail(session: PaymentSession, failure: PaymentFailure): PaymentSession {
  return advance(session, 'failed', { failure })
}

/** Throws unless the session is at the step an operation expects. */
export function assertStep(session: PaymentSession, expected: PaymentStep): void {
  if (session.step !== expected) {
    throw new AppError(
      'invalid_payment_step',
      `Expected a ${expected} payment, got ${session.step}`,
      409,
    )
  }
}
