import { vi } from 'vitest'
import { OpenPaymentsError } from '../open-payments/errors'
import type { OpenPaymentsPort } from '../open-payments/port'
import type {
  GrantedAccess,
  IncomingPaymentInfo,
  QuoteInfo,
  WalletAddressInfo,
} from '../open-payments/types'

// Test support: an in-memory stand-in for the Open Payments gateway, shaped like the Interledger
// test wallet (tenant paths on auth/resource servers, ZAR customer, COP shop).

export const customerWallet: WalletAddressInfo = {
  id: 'https://ilp.interledger-test.dev/southtest',
  publicName: 'South Test',
  assetCode: 'ZAR',
  assetScale: 2,
  authServer: 'https://auth.interledger-test.dev/tenant-a',
  resourceServer: 'https://ilp.interledger-test.dev/tenant-a',
}

export const merchantWallet: WalletAddressInfo = {
  id: 'https://ilp.interledger-test.dev/merchanttest',
  publicName: 'Merchant Test',
  assetCode: 'COP',
  assetScale: 2,
  authServer: 'https://auth.interledger-test.dev/tenant-b',
  resourceServer: 'https://ilp.interledger-test.dev/tenant-b',
}

export const ALLOWED_HOSTS = ['interledger-test.dev']

export const access = (token: string): GrantedAccess => ({
  accessToken: { value: token, manage: `https://auth.interledger-test.dev/token/${token}` },
  continuation: {
    uri: `https://auth.interledger-test.dev/continue/${token}`,
    accessToken: `continue-${token}`,
    waitSeconds: 0,
  },
})

/** A fake port whose methods are vi.fn() with realistic defaults; override per test. */
export function createFakeOpenPayments(): {
  [K in keyof OpenPaymentsPort]: ReturnType<typeof vi.fn<OpenPaymentsPort[K]>>
} {
  const wallets = new Map([customerWallet, merchantWallet].map((w) => [w.id, w]))
  const incoming = new Map<string, IncomingPaymentInfo>()
  const quotes = new Map<string, QuoteInfo>()

  return {
    getWalletAddress: vi.fn<OpenPaymentsPort['getWalletAddress']>(async (url) => {
      const wallet = wallets.get(url)
      if (!wallet) throw new OpenPaymentsError('wallet_not_found', `No wallet at ${url}`)
      return wallet
    }),
    requestGrant: vi.fn<OpenPaymentsPort['requestGrant']>(async (_authServer, request) =>
      request.type === 'outgoing-payment'
        ? {
            status: 'pending',
            interaction: {
              redirectUrl: 'https://wallet.interledger-test.dev/grant-interactions?id=1',
              finishNonce: 'as-nonce',
              continuation: access('outgoing').continuation,
            },
          }
        : { status: 'granted', access: access(request.type) },
    ),
    continueGrant: vi.fn<OpenPaymentsPort['continueGrant']>(async () => ({
      status: 'granted',
      access: access('outgoing'),
    })),
    rotateToken: vi.fn<OpenPaymentsPort['rotateToken']>(async (token) => ({
      ...token,
      value: `${token.value}-rotated`,
    })),
    createIncomingPayment: vi.fn<OpenPaymentsPort['createIncomingPayment']>(
      async (resourceServer, _token, args) => {
        const payment: IncomingPaymentInfo = {
          id: `${resourceServer}/incoming-payments/ip-${incoming.size + 1}`,
          walletAddress: args.walletAddress,
          incomingAmount: args.incomingAmount,
          receivedAmount: { ...args.incomingAmount, value: '0' },
          completed: false,
          expiresAt: args.expiresAt,
        }
        incoming.set(payment.id, payment)
        return payment
      },
    ),
    getIncomingPayment: vi.fn<OpenPaymentsPort['getIncomingPayment']>(async (url) => {
      const payment = incoming.get(url)
      if (!payment?.incomingAmount) throw new Error(`Unknown incoming payment ${url}`)
      return { ...payment, receivedAmount: payment.incomingAmount, completed: true }
    }),
    createQuote: vi.fn<OpenPaymentsPort['createQuote']>(async (resourceServer, _token, args) => {
      const receiver = incoming.get(args.receiver)
      if (!receiver?.incomingAmount) throw new Error(`Unknown receiver ${args.receiver}`)
      const quote: QuoteInfo = {
        id: `${resourceServer}/quotes/q-${quotes.size + 1}`,
        walletAddress: args.walletAddress,
        receiver: args.receiver,
        // A ZAR debit for the COP the shop asked for, fees included.
        debitAmount: { value: '105', assetCode: 'ZAR', assetScale: 2 },
        receiveAmount: receiver.incomingAmount,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }
      quotes.set(quote.id, quote)
      return quote
    }),
    createOutgoingPayment: vi.fn<OpenPaymentsPort['createOutgoingPayment']>(
      async (resourceServer, _token, args) => {
        const quote = quotes.get(args.quoteId)
        if (!quote) throw new Error(`Unknown quote ${args.quoteId}`)
        return {
          id: `${resourceServer}/outgoing-payments/op-1`,
          walletAddress: args.walletAddress,
          debitAmount: quote.debitAmount,
          receiveAmount: quote.receiveAmount,
          sentAmount: { ...quote.debitAmount, value: '0' },
          failed: false,
        }
      },
    ),
    getOutgoingPayment: vi.fn<OpenPaymentsPort['getOutgoingPayment']>(async (url) => ({
      id: url,
      walletAddress: customerWallet.id,
      debitAmount: { value: '105', assetCode: 'ZAR', assetScale: 2 },
      receiveAmount: { value: '100', assetCode: 'COP', assetScale: 2 },
      sentAmount: { value: '105', assetCode: 'ZAR', assetScale: 2 },
      failed: false,
    })),
  }
}

/** A sleep that returns immediately and remembers how long it was asked to wait. */
export function createFakeSleep() {
  const waits: number[] = []
  return { waits, sleep: async (ms: number) => void waits.push(ms) }
}
