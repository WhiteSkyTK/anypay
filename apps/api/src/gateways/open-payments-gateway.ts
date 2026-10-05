import {
  type AuthenticatedClient,
  createAuthenticatedClient,
  type GrantContinuation as SdkGrantContinuation,
  type GrantRequest,
  type GrantWithAccessToken,
  type IncomingPayment,
  isFinalizedGrantWithAccessToken,
  isPendingGrant,
  OpenPaymentsClientError,
  type OutgoingPayment,
  type Quote,
  type WalletAddress,
} from '@interledger/open-payments'
import type { KeyObject } from 'node:crypto'
import { OpenPaymentsError, type OpenPaymentsErrorCode } from '../open-payments/errors'
import type { OpenPaymentsPort } from '../open-payments/port'
import type {
  AccessToken,
  ContinueResult,
  CreateIncomingPaymentArgs,
  CreateOutgoingPaymentArgs,
  CreateQuoteArgs,
  GrantAccessRequest,
  GrantContinuation,
  GrantedAccess,
  GrantResult,
  IncomingPaymentInfo,
  OutgoingPaymentInfo,
  QuoteInfo,
  WalletAddressInfo,
} from '../open-payments/types'

/** AnyPay's own identity as an Open Payments client: its wallet address and signing key. */
export interface OpenPaymentsClientConfig {
  walletAddressUrl: string
  keyId: string
  privateKey: KeyObject
}

type Operation = keyof OpenPaymentsPort

const REQUEST_TIMEOUT_MS = 15_000

// --- SDK → AnyPay shapes ---------------------------------------------------------------------

export const toWalletAddressInfo = (w: WalletAddress): WalletAddressInfo => ({
  id: w.id,
  publicName: w.publicName,
  assetCode: w.assetCode,
  assetScale: w.assetScale,
  authServer: w.authServer,
  resourceServer: w.resourceServer,
})

const toContinuation = (c: SdkGrantContinuation['continue']): GrantContinuation => ({
  uri: c.uri,
  accessToken: c.access_token.value,
  waitSeconds: c.wait ?? 0,
})

const toAccessToken = (t: GrantWithAccessToken['access_token']): AccessToken => ({
  value: t.value,
  manage: t.manage,
  expiresIn: t.expires_in,
})

const toGrantedAccess = (grant: GrantWithAccessToken): GrantedAccess => ({
  accessToken: toAccessToken(grant.access_token),
  continuation: toContinuation(grant.continue),
})

export const toIncomingPaymentInfo = (p: IncomingPayment): IncomingPaymentInfo => ({
  id: p.id,
  walletAddress: p.walletAddress,
  incomingAmount: p.incomingAmount,
  receivedAmount: p.receivedAmount,
  completed: p.completed,
  expiresAt: p.expiresAt,
})

export const toQuoteInfo = (q: Quote): QuoteInfo => ({
  id: q.id,
  walletAddress: q.walletAddress,
  receiver: q.receiver,
  debitAmount: q.debitAmount,
  receiveAmount: q.receiveAmount,
  expiresAt: q.expiresAt,
})

export const toOutgoingPaymentInfo = (p: OutgoingPayment): OutgoingPaymentInfo => ({
  id: p.id,
  walletAddress: p.walletAddress,
  debitAmount: p.debitAmount,
  receiveAmount: p.receiveAmount,
  sentAmount: p.sentAmount,
  failed: p.failed,
})

// --- AnyPay → SDK grant requests --------------------------------------------------------------

/** The exact access each grant asks for (CLAUDE.md Open Payments flow, steps 2–4). */
export function toSdkGrantRequest(request: GrantAccessRequest): Omit<GrantRequest, 'client'> {
  switch (request.type) {
    case 'incoming-payment':
      // 'read' lets the watcher poll the payment until it completes.
      return {
        access_token: {
          access: [{ type: 'incoming-payment', actions: ['create', 'read', 'complete'] }],
        },
      }
    case 'quote':
      return { access_token: { access: [{ type: 'quote', actions: ['create', 'read'] }] } }
    case 'outgoing-payment': {
      const { walletAddress, debitAmount, interval, finish } = request
      return {
        access_token: {
          access: [
            {
              type: 'outgoing-payment',
              actions: ['create', 'read'],
              identifier: walletAddress,
              limits: interval ? { debitAmount, interval } : { debitAmount },
            },
          ],
        },
        interact: {
          start: ['redirect'],
          ...(finish && { finish: { method: 'redirect', uri: finish.uri, nonce: finish.nonce } }),
        },
      }
    }
  }
}

// --- SDK errors → AnyPay error codes ----------------------------------------------------------

interface ErrorRule {
  code: OpenPaymentsErrorCode
  matches: (error: OpenPaymentsClientError, operation: Operation) => boolean
}

// Order matters: first match wins. Statuses and messages come from Rafiki (the test wallet).
const ERROR_RULES: ErrorRule[] = [
  { code: 'consent_declined', matches: (e) => e.code === 'request_denied' },
  { code: 'too_fast', matches: (e) => e.code === 'too_fast' },
  { code: 'token_expired', matches: (e) => e.status === 401 },
  { code: 'wallet_not_found', matches: (e, op) => op === 'getWalletAddress' && e.status === 404 },
  // Rafiki answers "unauthorized" (403) when a payment would exceed the grant's limits.
  { code: 'grant_limit', matches: (e, op) => op === 'createOutgoingPayment' && e.status === 403 },
  // Rafiki answers "invalid quote" (400) for an expired or already-used quote.
  {
    code: 'quote_expired',
    matches: (e, op) =>
      op === 'createOutgoingPayment' &&
      e.status === 400 &&
      /quote/i.test(e.description ?? e.message),
  },
]

export function toOpenPaymentsError(error: unknown, operation: Operation): OpenPaymentsError {
  if (!(error instanceof OpenPaymentsClientError)) {
    // Timeouts, DNS and connection failures: the wallet provider is unreachable.
    return new OpenPaymentsError('open_payments_unavailable', `${operation} failed`, { operation })
  }
  const upstream = {
    operation,
    status: error.status,
    code: error.code,
    description: error.description,
  }
  const rule = ERROR_RULES.find((candidate) => candidate.matches(error, operation))
  const code = rule?.code ?? 'open_payments_error'
  return new OpenPaymentsError(code, error.description || error.message, upstream)
}

// --- The gateway --------------------------------------------------------------------------------

/**
 * The only module that imports `@interledger/open-payments`. It signs every request as AnyPay's
 * own wallet address (CLIENT_WALLET_ADDRESS + KEY_ID + private key, from env only), translates
 * SDK shapes into AnyPay's types and SDK errors into AnyPay error codes.
 */
export class OpenPaymentsGateway implements OpenPaymentsPort {
  readonly #config: OpenPaymentsClientConfig | undefined
  #client: Promise<AuthenticatedClient> | undefined

  constructor(config: OpenPaymentsClientConfig | undefined) {
    this.#config = config
  }

  /** False until CLIENT_WALLET_ADDRESS, KEY_ID and a private key are configured. */
  get isConfigured(): boolean {
    return this.#config !== undefined
  }

  #getClient(): Promise<AuthenticatedClient> {
    const config = this.#config
    if (!config) {
      const message =
        'Set CLIENT_WALLET_ADDRESS, KEY_ID and PRIVATE_KEY (or PRIVATE_KEY_PATH) in .env'
      return Promise.reject(new OpenPaymentsError('open_payments_not_configured', message))
    }
    // Created on first use, so the API still starts (and /health works) without credentials.
    this.#client ??= createAuthenticatedClient({
      walletAddressUrl: config.walletAddressUrl,
      keyId: config.keyId,
      privateKey: config.privateKey,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
      logLevel: 'silent', // the SDK's own logs could include request details; we log safely ourselves
    }).catch((error: unknown) => {
      this.#client = undefined
      throw error
    })
    return this.#client
  }

  async #call<T>(
    operation: Operation,
    run: (client: AuthenticatedClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.#getClient()
    try {
      return await run(client)
    } catch (error) {
      throw toOpenPaymentsError(error, operation)
    }
  }

  getWalletAddress(url: string): Promise<WalletAddressInfo> {
    return this.#call('getWalletAddress', async (client) =>
      toWalletAddressInfo(await client.walletAddress.get({ url })),
    )
  }

  requestGrant(authServer: string, request: GrantAccessRequest): Promise<GrantResult> {
    return this.#call('requestGrant', async (client) => {
      const grant = await client.grant.request({ url: authServer }, toSdkGrantRequest(request))
      if (isPendingGrant(grant)) {
        return {
          status: 'pending',
          interaction: {
            redirectUrl: grant.interact.redirect,
            finishNonce: grant.interact.finish,
            continuation: toContinuation(grant.continue),
          },
        }
      }
      if (!isFinalizedGrantWithAccessToken(grant)) {
        throw new OpenPaymentsError('open_payments_error', 'Grant has no access token')
      }
      return { status: 'granted', access: toGrantedAccess(grant) }
    })
  }

  continueGrant(continuation: GrantContinuation, interactRef?: string): Promise<ContinueResult> {
    return this.#call('continueGrant', async (client) => {
      const result = await client.grant.continue(
        { url: continuation.uri, accessToken: continuation.accessToken },
        interactRef ? { interact_ref: interactRef } : undefined,
      )
      return isFinalizedGrantWithAccessToken(result)
        ? { status: 'granted', access: toGrantedAccess(result) }
        : { status: 'pending', continuation: toContinuation(result.continue) }
    })
  }

  rotateToken(token: AccessToken): Promise<AccessToken> {
    return this.#call('rotateToken', async (client) => {
      const rotated = await client.token.rotate({ url: token.manage, accessToken: token.value })
      return toAccessToken(rotated.access_token)
    })
  }

  createIncomingPayment(
    resourceServer: string,
    accessToken: string,
    args: CreateIncomingPaymentArgs,
  ): Promise<IncomingPaymentInfo> {
    return this.#call('createIncomingPayment', async (client) =>
      toIncomingPaymentInfo(
        await client.incomingPayment.create({ url: resourceServer, accessToken }, args),
      ),
    )
  }

  getIncomingPayment(url: string, accessToken: string): Promise<IncomingPaymentInfo> {
    return this.#call('getIncomingPayment', async (client) =>
      toIncomingPaymentInfo(await client.incomingPayment.get({ url, accessToken })),
    )
  }

  createQuote(
    resourceServer: string,
    accessToken: string,
    args: CreateQuoteArgs,
  ): Promise<QuoteInfo> {
    return this.#call('createQuote', async (client) =>
      toQuoteInfo(
        await client.quote.create(
          { url: resourceServer, accessToken },
          { walletAddress: args.walletAddress, receiver: args.receiver, method: 'ilp' },
        ),
      ),
    )
  }

  createOutgoingPayment(
    resourceServer: string,
    accessToken: string,
    args: CreateOutgoingPaymentArgs,
  ): Promise<OutgoingPaymentInfo> {
    return this.#call('createOutgoingPayment', async (client) =>
      toOutgoingPaymentInfo(
        await client.outgoingPayment.create({ url: resourceServer, accessToken }, args),
      ),
    )
  }

  getOutgoingPayment(url: string, accessToken: string): Promise<OutgoingPaymentInfo> {
    return this.#call('getOutgoingPayment', async (client) =>
      toOutgoingPaymentInfo(await client.outgoingPayment.get({ url, accessToken })),
    )
  }
}
