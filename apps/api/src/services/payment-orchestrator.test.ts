import { MoneyError } from '@anypay/shared'
import { describe, expect, it } from 'vitest'
import { OpenPaymentsError } from '../open-payments/errors'
import { computeInteractHash } from '../open-payments/interact-hash'
import {
  ALLOWED_HOSTS,
  createFakeOpenPayments,
  createFakeSleep,
  customerWallet,
  merchantWallet,
} from '../testing/fake-open-payments'
import { GrantService } from './grant-service'
import { PaymentOrchestrator } from './payment-orchestrator'
import type { PaymentSession } from './payment-session'
import { WalletAddressResolver } from './wallet-address-resolver'

const FINISH_URI = 'http://127.0.0.1:3344/callback'
const input = {
  customerWallet: '$ilp.interledger-test.dev/southtest',
  merchantWallet: '$ilp.interledger-test.dev/merchanttest',
  amount: '25.50',
  finishUri: FINISH_URI,
  description: 'Bread and milk',
}

function setup(now = () => new Date()) {
  const openPayments = createFakeOpenPayments()
  const steps: PaymentSession[] = []
  const orchestrator = new PaymentOrchestrator({
    openPayments,
    grants: new GrantService(openPayments, {
      sleep: createFakeSleep().sleep,
      maxContinueAttempts: 2,
    }),
    wallets: new WalletAddressResolver(openPayments, ALLOWED_HOSTS),
    now,
    onStep: (session) => steps.push(session),
  })
  return { openPayments, orchestrator, steps }
}

function approvalFor(session: PaymentSession, interactRef = 'ref-1') {
  const consent = session.consent
  if (!consent) throw new Error('no consent on session')
  const hash = computeInteractHash({
    clientNonce: consent.clientNonce,
    interactNonce: consent.finishNonce,
    interactRef,
    grantEndpoint: consent.grantEndpoint,
  })
  return { interactRef, hash }
}

describe('startPayment', () => {
  it('creates the shop’s request, quotes it and asks the customer for consent', async () => {
    const { openPayments, orchestrator, steps } = setup()
    const session = await orchestrator.startPayment(input)

    expect(session.step).toBe('awaiting-consent')
    // The shop asked for 25.50 in its own currency (COP), in minor units.
    expect(openPayments.createIncomingPayment).toHaveBeenCalledWith(
      merchantWallet.resourceServer,
      'incoming-payment',
      expect.objectContaining({
        walletAddress: merchantWallet.id,
        incomingAmount: { value: '2550', assetCode: 'COP', assetScale: 2 },
        metadata: expect.objectContaining({ description: 'Bread and milk' }),
      }),
    )
    // The quote pays into that exact incoming payment, from the customer's wallet.
    expect(openPayments.createQuote).toHaveBeenCalledWith(customerWallet.resourceServer, 'quote', {
      walletAddress: customerWallet.id,
      receiver: session.incomingPayment?.id,
    })
    // Consent is capped at exactly what the quote debits.
    expect(openPayments.requestGrant).toHaveBeenLastCalledWith(
      customerWallet.authServer,
      expect.objectContaining({
        type: 'outgoing-payment',
        debitAmount: session.quote?.debitAmount,
      }),
    )
    expect(session.consent?.redirectUrl).toContain('grant-interactions')
    expect(steps.map((s) => s.step)).toEqual([
      'created',
      'incoming-payment-created',
      'quoted',
      'awaiting-consent',
    ])
  })

  it('rejects zero and malformed amounts before calling any wallet', async () => {
    const { openPayments, orchestrator } = setup()
    await expect(orchestrator.startPayment({ ...input, amount: '0' })).rejects.toMatchObject({
      code: 'invalid_amount',
    })
    await expect(orchestrator.startPayment({ ...input, amount: '1.234' })).rejects.toBeInstanceOf(
      MoneyError,
    )
    expect(openPayments.createIncomingPayment).not.toHaveBeenCalled()
  })

  it('refuses wallets off the allowlist', async () => {
    const { orchestrator } = setup()
    await expect(
      orchestrator.startPayment({ ...input, merchantWallet: 'https://evil.example/shop' }),
    ).rejects.toMatchObject({ code: 'wallet_host_not_allowed' })
  })

  it('keeps what was created when the customer’s wallet refuses up front', async () => {
    const { openPayments, orchestrator } = setup()
    const grantAsUsual = openPayments.requestGrant.getMockImplementation()
    openPayments.requestGrant.mockImplementation(async (server, request) => {
      if (request.type === 'outgoing-payment') throw new OpenPaymentsError('consent_declined', 'no')
      if (!grantAsUsual) throw new Error('fake has no default grant')
      return grantAsUsual(server, request)
    })
    const session = await orchestrator.startPayment(input)
    expect(session).toMatchObject({ step: 'failed', failure: 'consent_declined' })
    expect(session.incomingPayment).toBeDefined()
    expect(session.quote).toBeDefined()
  })

  it('throws unexpected failures instead of hiding them', async () => {
    const { openPayments, orchestrator } = setup()
    openPayments.createQuote.mockRejectedValueOnce(
      new OpenPaymentsError('open_payments_unavailable', 'wallet down'),
    )
    await expect(orchestrator.startPayment(input)).rejects.toMatchObject({
      code: 'open_payments_unavailable',
    })
  })
})

describe('finishPayment', () => {
  it('verifies the approval and creates the outgoing payment from the quote', async () => {
    const { openPayments, orchestrator, steps } = setup()
    const started = await orchestrator.startPayment(input)
    const sent = await orchestrator.finishPayment(started, approvalFor(started))

    expect(sent.step).toBe('sending')
    expect(openPayments.continueGrant).toHaveBeenCalledWith(started.consent?.continuation, 'ref-1')
    expect(openPayments.createOutgoingPayment).toHaveBeenCalledWith(
      customerWallet.resourceServer,
      'outgoing',
      expect.objectContaining({ walletAddress: customerWallet.id, quoteId: started.quote?.id }),
    )
    expect(steps.at(-1)?.step).toBe('sending')
  })

  it('fails as consent_declined when the customer says no', async () => {
    const { openPayments, orchestrator } = setup()
    openPayments.continueGrant.mockRejectedValueOnce(
      new OpenPaymentsError('consent_declined', 'no'),
    )
    const started = await orchestrator.startPayment(input)
    await expect(orchestrator.finishPayment(started, approvalFor(started))).resolves.toMatchObject({
      step: 'failed',
      failure: 'consent_declined',
    })
  })

  it('fails as consent_declined when the wallet redirects back with a rejection', async () => {
    const { orchestrator } = setup()
    const started = await orchestrator.startPayment(input)
    expect(orchestrator.declinePayment(started)).toMatchObject({
      step: 'failed',
      failure: 'consent_declined',
    })
  })

  it('fails as consent_invalid when the callback hash is forged', async () => {
    const { openPayments, orchestrator } = setup()
    const started = await orchestrator.startPayment(input)
    const forged = { interactRef: 'ref-1', hash: 'AAAA' }
    await expect(orchestrator.finishPayment(started, forged)).resolves.toMatchObject({
      failure: 'consent_invalid',
    })
    expect(openPayments.createOutgoingPayment).not.toHaveBeenCalled()
  })

  it('fails as quote_expired without continuing when the quote ran out first', async () => {
    let now = new Date('2026-10-06T10:00:00Z')
    const { openPayments, orchestrator } = setup(() => now)
    const started = await orchestrator.startPayment(input)
    now = new Date(Date.parse(started.quote?.expiresAt ?? '') + 1000)
    await expect(orchestrator.finishPayment(started, approvalFor(started))).resolves.toMatchObject({
      failure: 'quote_expired',
    })
    expect(openPayments.continueGrant).not.toHaveBeenCalled()
  })

  it.each([
    ['quote_expired', 'quote_expired'],
    ['grant_limit', 'grant_limit'],
  ] as const)('maps a %s error from the wallet to a %s failure', async (code, failure) => {
    const { openPayments, orchestrator } = setup()
    openPayments.createOutgoingPayment.mockRejectedValueOnce(new OpenPaymentsError(code, code))
    const started = await orchestrator.startPayment(input)
    await expect(orchestrator.finishPayment(started, approvalFor(started))).resolves.toMatchObject({
      step: 'failed',
      failure,
    })
  })

  it('only finishes payments that are waiting for consent', async () => {
    const { orchestrator } = setup()
    const started = await orchestrator.startPayment(input)
    const sent = await orchestrator.finishPayment(started, approvalFor(started))
    await expect(orchestrator.finishPayment(sent, approvalFor(started))).rejects.toMatchObject({
      code: 'invalid_payment_step',
    })
  })
})
