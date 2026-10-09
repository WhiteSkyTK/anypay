import type { Money } from '@anypay/shared'

// AnyPay's own view of Open Payments resources. Only the gateway knows the SDK's shapes, so the
// rest of the API (and its tests) never depends on @interledger/open-payments directly.

/** What we need from a wallet address (CLAUDE.md step 1). */
export interface WalletAddressInfo {
  id: string
  publicName?: string
  assetCode: string
  assetScale: number
  authServer: string
  resourceServer: string
}

export interface AccessToken {
  value: string
  /** Token management URL: rotate or revoke the token here. */
  manage: string
  expiresIn?: number
}

/** How to continue a grant: the URL, the continuation token and how long the AS asks us to wait. */
export interface GrantContinuation {
  uri: string
  accessToken: string
  waitSeconds: number
}

export interface GrantedAccess {
  accessToken: AccessToken
  continuation: GrantContinuation
}

export interface PendingInteraction {
  /** Where the customer approves the request in their own wallet. */
  redirectUrl: string
  /** The auth server's "finish" nonce: one of the four inputs to the callback hash. */
  finishNonce: string
  continuation: GrantContinuation
}

export type GrantAccessRequest =
  | { type: 'incoming-payment' }
  | { type: 'quote' }
  | {
      type: 'outgoing-payment'
      /** The paying wallet address the grant is for. */
      walletAddress: string
      /** Most the customer can be debited (per interval, if one is set). */
      debitAmount: Money
      /** ISO 8601 repeating interval, e.g. 'R/2026-10-06T00:00:00Z/P1W' (tabs, Phase 3). */
      interval?: string
      /** Where the auth server sends the customer after consent; omit to poll instead. */
      finish?: { uri: string; nonce: string }
    }

export type GrantResult =
  | { status: 'granted'; access: GrantedAccess }
  | { status: 'pending'; interaction: PendingInteraction }

export type ContinueResult =
  | { status: 'granted'; access: GrantedAccess }
  | { status: 'pending'; continuation: GrantContinuation }

export interface IncomingPaymentInfo {
  id: string
  walletAddress: string
  incomingAmount?: Money
  receivedAmount: Money
  completed: boolean
  expiresAt?: string
}

export interface QuoteInfo {
  id: string
  walletAddress: string
  receiver: string
  /** What the customer pays, fees and FX included. */
  debitAmount: Money
  /** What the shop receives. */
  receiveAmount: Money
  expiresAt?: string
}

export interface OutgoingPaymentInfo {
  id: string
  walletAddress: string
  debitAmount: Money
  receiveAmount: Money
  sentAmount: Money
  failed: boolean
}

export interface CreateIncomingPaymentArgs {
  walletAddress: string
  incomingAmount: Money
  expiresAt: string
  metadata?: Record<string, unknown>
}

export interface CreateQuoteArgs {
  walletAddress: string
  /** The incoming payment URL the quote pays into. */
  receiver: string
}

export interface CreateOutgoingPaymentArgs {
  walletAddress: string
  quoteId: string
  metadata?: Record<string, unknown>
}
