import { describe, expect, it } from 'vitest'
import { ApiRequestError } from './api'
import { errorMessageKey, failureMessageKey } from './error-message'

describe('errorMessageKey', () => {
  it('maps a known API code to its own message', () => {
    const error = new ApiRequestError('wallet_not_found', 'No wallet', 404)
    expect(errorMessageKey(error)).toBe('errors.api.wallet_not_found')
  })

  it('keeps an i18n key the API already chose (validation errors)', () => {
    const error = new ApiRequestError('invalid_request', 'errors.walletAddress.format', 400)
    expect(errorMessageKey(error)).toBe('errors.walletAddress.format')
  })

  it('falls back to the general message for unknown codes and non-API errors', () => {
    expect(errorMessageKey(new ApiRequestError('teapot', 'I am a teapot', 418))).toBe(
      'errors.api.unknown',
    )
    expect(errorMessageKey(new TypeError('boom'))).toBe('errors.api.unknown')
  })
})

describe('failureMessageKey', () => {
  it('points at the failures namespace', () => {
    expect(failureMessageKey('consent_declined')).toBe('failures.consent_declined')
  })
})
