import {
  mockIncomingPayment,
  mockOutgoingPayment,
  mockQuote,
  mockWalletAddress,
  OpenPaymentsClientError,
} from '@interledger/open-payments'
import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  OpenPaymentsGateway,
  toIncomingPaymentInfo,
  toOpenPaymentsError,
  toOutgoingPaymentInfo,
  toQuoteInfo,
  toSdkGrantRequest,
  toWalletAddressInfo,
} from './open-payments-gateway'

const debitAmount = { value: '105', assetCode: 'ZAR', assetScale: 2 }

describe('toSdkGrantRequest', () => {
  it('asks for create, read and complete on incoming payments', () => {
    expect(toSdkGrantRequest({ type: 'incoming-payment' })).toEqual({
      access_token: {
        access: [{ type: 'incoming-payment', actions: ['create', 'read', 'complete'] }],
      },
    })
  })

  it('asks for create and read on quotes', () => {
    expect(toSdkGrantRequest({ type: 'quote' })).toEqual({
      access_token: { access: [{ type: 'quote', actions: ['create', 'read'] }] },
    })
  })

  it('asks for a capped, interactive outgoing payment with a redirect callback', () => {
    const request = toSdkGrantRequest({
      type: 'outgoing-payment',
      walletAddress: 'https://ilp.interledger-test.dev/southtest',
      debitAmount,
      finish: { uri: 'http://127.0.0.1:3344/callback', nonce: 'n-1' },
    })
    expect(request).toEqual({
      access_token: {
        access: [
          {
            type: 'outgoing-payment',
            actions: ['create', 'read'],
            identifier: 'https://ilp.interledger-test.dev/southtest',
            limits: { debitAmount },
          },
        ],
      },
      interact: {
        start: ['redirect'],
        finish: { method: 'redirect', uri: 'http://127.0.0.1:3344/callback', nonce: 'n-1' },
      },
    })
  })

  it('adds the interval for recurring limits and omits finish when polling', () => {
    const request = toSdkGrantRequest({
      type: 'outgoing-payment',
      walletAddress: 'w',
      debitAmount,
      interval: 'R/2026-10-06T00:00:00Z/P1W',
    })
    expect(request.access_token?.access[0]).toMatchObject({
      limits: { debitAmount, interval: 'R/2026-10-06T00:00:00Z/P1W' },
    })
    expect(request.interact).toEqual({ start: ['redirect'] })
  })
})

describe('toOpenPaymentsError', () => {
  const clientError = (
    status: number | undefined,
    extra: { code?: string; description?: string } = {},
  ) =>
    new OpenPaymentsClientError('Request failed', {
      description: extra.description ?? 'failed',
      status,
      code: extra.code,
    })

  it.each([
    ['consent_declined', clientError(401, { code: 'request_denied' }), 'continueGrant'],
    ['too_fast', clientError(400, { code: 'too_fast' }), 'continueGrant'],
    ['token_expired', clientError(401), 'getIncomingPayment'],
    ['wallet_not_found', clientError(404), 'getWalletAddress'],
    ['grant_limit', clientError(403, { description: 'unauthorized' }), 'createOutgoingPayment'],
    ['quote_expired', clientError(400, { description: 'invalid quote' }), 'createOutgoingPayment'],
    [
      'open_payments_error',
      clientError(400, { description: 'invalid amount' }),
      'createOutgoingPayment',
    ],
    ['open_payments_error', clientError(500), 'createQuote'],
  ] as const)('maps to %s', (code, error, operation) => {
    expect(toOpenPaymentsError(error, operation).code).toBe(code)
  })

  it('treats network failures as the wallet being unavailable', () => {
    expect(toOpenPaymentsError(new TypeError('fetch failed'), 'requestGrant').code).toBe(
      'open_payments_unavailable',
    )
  })

  it('keeps safe upstream details for the logs', () => {
    const error = toOpenPaymentsError(
      clientError(400, { description: 'invalid quote' }),
      'createOutgoingPayment',
    )
    expect(error.upstream).toEqual({
      operation: 'createOutgoingPayment',
      status: 400,
      code: undefined,
      description: 'invalid quote',
    })
  })
})

describe('mapping SDK resources', () => {
  it('keeps the fields AnyPay uses', () => {
    const wallet = mockWalletAddress()
    expect(toWalletAddressInfo(wallet)).toMatchObject({
      id: wallet.id,
      authServer: wallet.authServer,
      resourceServer: wallet.resourceServer,
      assetCode: wallet.assetCode,
      assetScale: wallet.assetScale,
    })
    const quote = mockQuote()
    expect(toQuoteInfo(quote)).toMatchObject({ id: quote.id, debitAmount: quote.debitAmount })
    const incoming = mockIncomingPayment()
    expect(toIncomingPaymentInfo(incoming)).toMatchObject({
      id: incoming.id,
      completed: incoming.completed,
    })
    const outgoing = mockOutgoingPayment()
    expect(toOutgoingPaymentInfo(outgoing)).toMatchObject({
      id: outgoing.id,
      failed: outgoing.failed,
    })
  })
})

describe('OpenPaymentsGateway', () => {
  it('reports not configured, without calling out, when there is no client key', async () => {
    const gateway = new OpenPaymentsGateway(undefined)
    expect(gateway.isConfigured).toBe(false)
    await expect(
      gateway.getWalletAddress('https://ilp.interledger-test.dev/x'),
    ).rejects.toMatchObject({
      code: 'open_payments_not_configured',
    })
  })

  it('is configured once it has a wallet address, key id and key', () => {
    const { privateKey } = generateKeyPairSync('ed25519')
    const gateway = new OpenPaymentsGateway({
      walletAddressUrl: 'https://ilp.interledger-test.dev/app',
      keyId: 'key-1',
      privateKey,
    })
    expect(gateway.isConfigured).toBe(true)
  })
})
