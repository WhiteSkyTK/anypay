import type { PaymentFailure } from '@anypay/shared'
import { ApiRequestError } from './api'

// Error codes the app has its own message for; anything else gets the general one.
const KNOWN_CODES = new Set([
  'network_error',
  'wallet_host_not_allowed',
  'wallet_address_invalid',
  'wallet_not_found',
  'shop_not_found',
  'payment_not_found',
  'rate_limited',
  'open_payments_unavailable',
  'open_payments_not_configured',
  'merchant_unauthorized',
  'invalid_amount',
])

/**
 * The i18n key for an error, so it shows in the user's language. Validation errors already carry
 * a key ('errors.walletAddress.format'); API codes map to 'errors.api.<code>'.
 */
export function errorMessageKey(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return 'errors.api.unknown'
  if (error.message.startsWith('errors.')) return error.message
  return KNOWN_CODES.has(error.code) ? `errors.api.${error.code}` : 'errors.api.unknown'
}

export const failureMessageKey = (failure: PaymentFailure) => `failures.${failure}` as const
