import type { Money } from '@anypay/shared'
import { randomBytes } from 'node:crypto'
import { OpenPaymentsError, isOpenPaymentsError } from '../open-payments/errors'
import { verifyInteractHash } from '../open-payments/interact-hash'
import type { OpenPaymentsPort } from '../open-payments/port'
import type {
  AccessToken,
  GrantAccessRequest,
  GrantContinuation,
  GrantedAccess,
  WalletAddressInfo,
} from '../open-payments/types'

type GrantPort = Pick<OpenPaymentsPort, 'requestGrant' | 'continueGrant' | 'rotateToken'>

/** Everything needed to finish an interactive grant once the customer comes back. */
export interface ConsentRequest {
  /** Where the customer approves the payment in their own wallet. */
  redirectUrl: string
  /** Our single-use nonce, sent in interact.finish. */
  clientNonce: string
  /** The auth server's nonce from its interact response. */
  finishNonce: string
  /** The auth server we asked: the fourth input to the callback hash. */
  grantEndpoint: string
  continuation: GrantContinuation
  /** When the grant was requested (ms since epoch); `wait` counts from here. */
  requestedAt: number
  /** True when the auth server redirects back with interact_ref + hash; false means we poll. */
  usesCallback: boolean
}

export interface ConsentCallback {
  interactRef: string
  hash: string
}

export interface PaymentConsentOptions {
  /** Most the customer can be debited: the quote's debitAmount (or a tab's weekly cap). */
  debitAmount: Money
  /** Our callback URL; omit to poll the grant instead of being redirected back. */
  finishUri?: string
  /** ISO 8601 repeating interval for recurring limits (tabs, Phase 3). */
  interval?: string
}

export interface GrantServiceOptions {
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  /** How many times to continue a grant the auth server says isn't ready yet. */
  maxContinueAttempts?: number
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Requests, continues and rotates Open Payments grants. The outgoing-payment grant is the one
 * that needs the customer: they approve it in their own wallet, and the callback hash proves
 * the approval came back from their auth server for this exact request.
 *
 * Phase 2 adds encrypted storage for tokens (AES-256-GCM, TOKEN_ENCRYPTION_KEY).
 */
export class GrantService {
  readonly #openPayments: GrantPort
  readonly #sleep: (ms: number) => Promise<void>
  readonly #now: () => number
  readonly #maxContinueAttempts: number

  constructor(openPayments: GrantPort, options: GrantServiceOptions = {}) {
    this.#openPayments = openPayments
    this.#sleep = options.sleep ?? realSleep
    this.#now = options.now ?? Date.now
    this.#maxContinueAttempts = options.maxContinueAttempts ?? 5
  }

  /** Non-interactive grant to create and read incoming payments on the merchant's wallet (step 2). */
  requestIncomingPaymentAccess(merchant: WalletAddressInfo): Promise<GrantedAccess> {
    return this.#requestNonInteractive(merchant.authServer, { type: 'incoming-payment' })
  }

  /** Non-interactive grant to create quotes on the customer's wallet (step 3). */
  requestQuoteAccess(customer: WalletAddressInfo): Promise<GrantedAccess> {
    return this.#requestNonInteractive(customer.authServer, { type: 'quote' })
  }

  /** Interactive outgoing-payment grant capped at `debitAmount` (step 4). */
  async requestPaymentConsent(
    customer: WalletAddressInfo,
    options: PaymentConsentOptions,
  ): Promise<ConsentRequest> {
    const clientNonce = randomBytes(24).toString('base64url')
    const requestedAt = this.#now()
    const result = await this.#openPayments.requestGrant(customer.authServer, {
      type: 'outgoing-payment',
      walletAddress: customer.id,
      debitAmount: options.debitAmount,
      interval: options.interval,
      finish: options.finishUri ? { uri: options.finishUri, nonce: clientNonce } : undefined,
    })
    if (result.status !== 'pending') {
      throw new OpenPaymentsError('open_payments_error', 'Expected the wallet to ask for consent')
    }
    return {
      redirectUrl: result.interaction.redirectUrl,
      clientNonce,
      finishNonce: result.interaction.finishNonce,
      grantEndpoint: customer.authServer,
      continuation: result.interaction.continuation,
      requestedAt,
      usesCallback: options.finishUri !== undefined,
    }
  }

  /**
   * After the customer approves: verifies the callback hash (callback mode), then continues the
   * grant to get the access token for creating the outgoing payment.
   */
  async completeConsent(
    consent: ConsentRequest,
    callback?: ConsentCallback,
  ): Promise<GrantedAccess> {
    if (consent.usesCallback) {
      const verified =
        callback !== undefined &&
        verifyInteractHash(
          {
            clientNonce: consent.clientNonce,
            interactNonce: consent.finishNonce,
            interactRef: callback.interactRef,
            grantEndpoint: consent.grantEndpoint,
          },
          callback.hash,
        )
      if (!verified) {
        throw new OpenPaymentsError('consent_invalid', 'The approval could not be verified')
      }
    }
    const waitUntil = consent.requestedAt + consent.continuation.waitSeconds * 1000
    await this.#sleep(Math.max(0, waitUntil - this.#now()))
    return this.#continue(consent.continuation, callback?.interactRef)
  }

  /** Swaps an expired access token for a new one, e.g. for a long-lived tab grant. */
  rotate(token: AccessToken): Promise<AccessToken> {
    return this.#openPayments.rotateToken(token)
  }

  async #requestNonInteractive(
    authServer: string,
    request: GrantAccessRequest,
  ): Promise<GrantedAccess> {
    const result = await this.#openPayments.requestGrant(authServer, request)
    if (result.status !== 'granted') {
      throw new OpenPaymentsError(
        'open_payments_error',
        `The ${request.type} grant asked for consent`,
      )
    }
    return result.access
  }

  /**
   * Continues a grant, honouring the auth server's `wait` and retrying while it answers
   * "too fast" or (in polling mode) "not approved yet".
   */
  async #continue(first: GrantContinuation, interactRef?: string): Promise<GrantedAccess> {
    let continuation = first
    for (let attempt = 1; attempt <= this.#maxContinueAttempts; attempt++) {
      try {
        const result = await this.#openPayments.continueGrant(continuation, interactRef)
        if (result.status === 'granted') return result.access
        continuation = result.continuation
      } catch (error) {
        if (!isOpenPaymentsError(error, 'too_fast')) throw error
      }
      await this.#sleep(Math.max(continuation.waitSeconds, 1) * 1000)
    }
    throw new OpenPaymentsError('consent_pending', 'The payment has not been approved yet')
  }
}
