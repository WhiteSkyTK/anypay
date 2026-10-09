import { AppError } from '../lib/errors'

/** Each code maps to one clear UI state (CLAUDE.md: every failure gets a clear UI state). */
export type OpenPaymentsErrorCode =
  | 'consent_declined'
  | 'consent_invalid'
  | 'consent_pending'
  | 'too_fast'
  | 'quote_expired'
  | 'grant_limit'
  | 'token_expired'
  | 'wallet_not_found'
  | 'open_payments_not_configured'
  | 'open_payments_unavailable'
  | 'open_payments_error'

const STATUS: Record<OpenPaymentsErrorCode, number> = {
  consent_declined: 409,
  consent_invalid: 400,
  consent_pending: 409,
  too_fast: 429,
  quote_expired: 409,
  grant_limit: 403,
  token_expired: 401,
  wallet_not_found: 404,
  open_payments_not_configured: 503,
  open_payments_unavailable: 502,
  open_payments_error: 502,
}

/** Safe-to-log facts about the upstream error: never tokens or request bodies. */
export interface UpstreamErrorDetails {
  operation: string
  status?: number
  code?: string
  description?: string
}

export class OpenPaymentsError extends AppError {
  override readonly code: OpenPaymentsErrorCode
  readonly upstream?: UpstreamErrorDetails

  constructor(code: OpenPaymentsErrorCode, message: string, upstream?: UpstreamErrorDetails) {
    super(code, message, STATUS[code])
    this.name = 'OpenPaymentsError'
    this.code = code
    this.upstream = upstream
  }
}

export function isOpenPaymentsError(
  error: unknown,
  code?: OpenPaymentsErrorCode,
): error is OpenPaymentsError {
  return error instanceof OpenPaymentsError && (code === undefined || error.code === code)
}
