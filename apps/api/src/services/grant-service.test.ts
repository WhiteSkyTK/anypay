import { describe, expect, it } from 'vitest'
import { OpenPaymentsError } from '../open-payments/errors'
import { computeInteractHash } from '../open-payments/interact-hash'
import {
  access,
  createFakeOpenPayments,
  createFakeSleep,
  customerWallet,
  merchantWallet,
} from '../testing/fake-open-payments'
import { type ConsentRequest, GrantService } from './grant-service'

const debitAmount = { value: '105', assetCode: 'ZAR', assetScale: 2 }
const FINISH_URI = 'http://127.0.0.1:3344/callback'

function setup(now = () => 1_000_000) {
  const openPayments = createFakeOpenPayments()
  const clock = createFakeSleep()
  const grants = new GrantService(openPayments, { sleep: clock.sleep, now, maxContinueAttempts: 3 })
  return { openPayments, clock, grants }
}

const callbackFor = (consent: ConsentRequest, interactRef = 'ref-1') => ({
  interactRef,
  hash: computeInteractHash({
    clientNonce: consent.clientNonce,
    interactNonce: consent.finishNonce,
    interactRef,
    grantEndpoint: consent.grantEndpoint,
  }),
})

describe('non-interactive grants', () => {
  it('asks the shop’s auth server for incoming-payment access', async () => {
    const { openPayments, grants } = setup()
    await expect(grants.requestIncomingPaymentAccess(merchantWallet)).resolves.toEqual(
      access('incoming-payment'),
    )
    expect(openPayments.requestGrant).toHaveBeenCalledWith(merchantWallet.authServer, {
      type: 'incoming-payment',
    })
  })

  it('asks the customer’s auth server for quote access', async () => {
    const { openPayments, grants } = setup()
    await grants.requestQuoteAccess(customerWallet)
    expect(openPayments.requestGrant).toHaveBeenCalledWith(customerWallet.authServer, {
      type: 'quote',
    })
  })

  it('refuses a grant that unexpectedly needs consent', async () => {
    const { openPayments, grants } = setup()
    openPayments.requestGrant.mockResolvedValueOnce({
      status: 'pending',
      interaction: { redirectUrl: 'x', finishNonce: 'y', continuation: access('q').continuation },
    })
    await expect(grants.requestQuoteAccess(customerWallet)).rejects.toMatchObject({
      code: 'open_payments_error',
    })
  })
})

describe('requestPaymentConsent', () => {
  it('asks for an outgoing-payment grant capped at the quote, with a callback', async () => {
    const { openPayments, grants } = setup()
    const consent = await grants.requestPaymentConsent(customerWallet, {
      debitAmount,
      finishUri: FINISH_URI,
    })

    expect(openPayments.requestGrant).toHaveBeenCalledWith(customerWallet.authServer, {
      type: 'outgoing-payment',
      walletAddress: customerWallet.id,
      debitAmount,
      interval: undefined,
      finish: { uri: FINISH_URI, nonce: consent.clientNonce },
    })
    expect(consent).toMatchObject({
      redirectUrl: expect.stringContaining('grant-interactions'),
      finishNonce: 'as-nonce',
      grantEndpoint: customerWallet.authServer,
      usesCallback: true,
    })
  })

  it('uses a fresh, unguessable nonce every time', async () => {
    const { grants } = setup()
    const nonces = await Promise.all(
      [1, 2, 3].map(async () => {
        const consent = await grants.requestPaymentConsent(customerWallet, {
          debitAmount,
          finishUri: FINISH_URI,
        })
        return consent.clientNonce
      }),
    )
    expect(new Set(nonces).size).toBe(3)
    expect(nonces[0]?.length).toBeGreaterThanOrEqual(32)
  })

  it('polls instead of redirecting when there is no callback URL', async () => {
    const { openPayments, grants } = setup()
    const consent = await grants.requestPaymentConsent(customerWallet, { debitAmount })
    expect(openPayments.requestGrant.mock.calls[0]?.[1]).toMatchObject({ finish: undefined })
    expect(consent.usesCallback).toBe(false)
  })

  it('passes a recurring interval through (tabs)', async () => {
    const { openPayments, grants } = setup()
    const interval = 'R/2026-10-06T00:00:00Z/P1W'
    await grants.requestPaymentConsent(customerWallet, { debitAmount, interval })
    expect(openPayments.requestGrant.mock.calls[0]?.[1]).toMatchObject({ interval })
  })
})

describe('completeConsent', () => {
  it('verifies the hash, then continues the grant with interact_ref', async () => {
    const { openPayments, grants } = setup()
    const consent = await grants.requestPaymentConsent(customerWallet, {
      debitAmount,
      finishUri: FINISH_URI,
    })
    await expect(grants.completeConsent(consent, callbackFor(consent))).resolves.toEqual(
      access('outgoing'),
    )
    expect(openPayments.continueGrant).toHaveBeenCalledWith(consent.continuation, 'ref-1')
  })

  it.each([
    ['a tampered hash', (c: ConsentRequest) => ({ ...callbackFor(c), hash: 'forged' })],
    [
      'a hash for another interaction',
      (c: ConsentRequest) => ({ ...callbackFor(c), interactRef: 'ref-2' }),
    ],
    ['no callback at all', () => undefined],
  ])('rejects %s without continuing the grant', async (_case, makeCallback) => {
    const { openPayments, grants } = setup()
    const consent = await grants.requestPaymentConsent(customerWallet, {
      debitAmount,
      finishUri: FINISH_URI,
    })
    await expect(grants.completeConsent(consent, makeCallback(consent))).rejects.toMatchObject({
      code: 'consent_invalid',
    })
    expect(openPayments.continueGrant).not.toHaveBeenCalled()
  })

  it('waits out the auth server’s `wait` before continuing', async () => {
    let now = 1_000_000
    const { openPayments, clock, grants } = setup(() => now)
    const continuation = { ...access('outgoing').continuation, waitSeconds: 5 }
    openPayments.requestGrant.mockResolvedValueOnce({
      status: 'pending',
      interaction: { redirectUrl: 'https://wallet/consent', finishNonce: 'as-nonce', continuation },
    })
    const consent = await grants.requestPaymentConsent(customerWallet, {
      debitAmount,
      finishUri: FINISH_URI,
    })
    now += 2000 // the customer took 2 s to approve
    await grants.completeConsent(consent, callbackFor(consent))
    expect(clock.waits[0]).toBe(3000)
  })

  it('retries when the auth server says "too fast"', async () => {
    const { openPayments, clock, grants } = setup()
    openPayments.continueGrant.mockRejectedValueOnce(new OpenPaymentsError('too_fast', 'slow down'))
    const consent = await grants.requestPaymentConsent(customerWallet, {
      debitAmount,
      finishUri: FINISH_URI,
    })
    await expect(grants.completeConsent(consent, callbackFor(consent))).resolves.toEqual(
      access('outgoing'),
    )
    expect(openPayments.continueGrant).toHaveBeenCalledTimes(2)
    expect(clock.waits.at(-1)).toBe(1000)
  })

  it('keeps polling with the newest continuation until approved', async () => {
    const { openPayments, grants } = setup()
    const next = { uri: 'https://auth/continue/2', accessToken: 'continue-2', waitSeconds: 2 }
    openPayments.continueGrant.mockResolvedValueOnce({ status: 'pending', continuation: next })
    const consent = await grants.requestPaymentConsent(customerWallet, { debitAmount })
    await grants.completeConsent(consent)
    expect(openPayments.continueGrant).toHaveBeenLastCalledWith(next, undefined)
  })

  it('gives up with consent_pending when it is never approved', async () => {
    const { openPayments, grants } = setup()
    openPayments.continueGrant.mockResolvedValue({
      status: 'pending',
      continuation: access('outgoing').continuation,
    })
    const consent = await grants.requestPaymentConsent(customerWallet, { debitAmount })
    await expect(grants.completeConsent(consent)).rejects.toMatchObject({ code: 'consent_pending' })
    expect(openPayments.continueGrant).toHaveBeenCalledTimes(3)
  })

  it('does not retry a declined consent', async () => {
    const { openPayments, grants } = setup()
    openPayments.continueGrant.mockRejectedValueOnce(
      new OpenPaymentsError('consent_declined', 'no'),
    )
    const consent = await grants.requestPaymentConsent(customerWallet, {
      debitAmount,
      finishUri: FINISH_URI,
    })
    await expect(grants.completeConsent(consent, callbackFor(consent))).rejects.toMatchObject({
      code: 'consent_declined',
    })
    expect(openPayments.continueGrant).toHaveBeenCalledTimes(1)
  })
})

describe('rotate', () => {
  it('swaps an expired token for a new one', async () => {
    const { grants } = setup()
    const token = access('tab').accessToken
    await expect(grants.rotate(token)).resolves.toMatchObject({ value: 'tab-rotated' })
  })
})
