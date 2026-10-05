import { describe, expect, it } from 'vitest'
import type { OutgoingPaymentInfo } from '../open-payments/types'
import {
  ALLOWED_HOSTS,
  createFakeOpenPayments,
  createFakeSleep,
} from '../testing/fake-open-payments'
import { computeInteractHash } from '../open-payments/interact-hash'
import { GrantService } from './grant-service'
import { PaymentOrchestrator } from './payment-orchestrator'
import type { PaymentSession } from './payment-session'
import { PaymentWatcher } from './payment-watcher'
import { WalletAddressResolver } from './wallet-address-resolver'

/** Runs the fake flow up to `sending`, ready to be watched. */
async function sentPayment() {
  const openPayments = createFakeOpenPayments()
  const orchestrator = new PaymentOrchestrator({
    openPayments,
    grants: new GrantService(openPayments, { sleep: createFakeSleep().sleep }),
    wallets: new WalletAddressResolver(openPayments, ALLOWED_HOSTS),
  })
  const started = await orchestrator.startPayment({
    customerWallet: '$ilp.interledger-test.dev/southtest',
    merchantWallet: '$ilp.interledger-test.dev/merchanttest',
    amount: '1.00',
    finishUri: 'http://127.0.0.1:3344/callback',
  })
  const consent = started.consent as NonNullable<PaymentSession['consent']>
  const hash = computeInteractHash({
    clientNonce: consent.clientNonce,
    interactNonce: consent.finishNonce,
    interactRef: 'ref',
    grantEndpoint: consent.grantEndpoint,
  })
  const session = await orchestrator.finishPayment(started, { interactRef: 'ref', hash })
  return { openPayments, session }
}

function watcherFor(openPayments: ReturnType<typeof createFakeOpenPayments>, timeoutMs = 10_000) {
  let now = 0
  const clock = createFakeSleep()
  const watcher = new PaymentWatcher(openPayments, {
    intervalMs: 1000,
    maxIntervalMs: 3000,
    timeoutMs,
    sleep: async (ms) => {
      now += ms
      await clock.sleep(ms)
    },
    now: () => now,
  })
  return { watcher, waits: clock.waits }
}

const failedOutgoing = (sent: string): OutgoingPaymentInfo => ({
  id: 'op',
  walletAddress: 'w',
  debitAmount: { value: '105', assetCode: 'ZAR', assetScale: 2 },
  receiveAmount: { value: '100', assetCode: 'COP', assetScale: 2 },
  sentAmount: { value: sent, assetCode: 'ZAR', assetScale: 2 },
  failed: true,
})

describe('PaymentWatcher', () => {
  it('completes when the shop’s incoming payment is fully paid', async () => {
    const { openPayments, session } = await sentPayment()
    const { watcher } = watcherFor(openPayments)
    const done = await watcher.waitForCompletion(session)
    expect(done.step).toBe('completed')
    expect(done.incomingPayment?.receivedAmount).toEqual(session.amount)
  })

  it('counts a fully received amount as paid even before the wallet marks it completed', async () => {
    const { openPayments, session } = await sentPayment()
    openPayments.getIncomingPayment.mockResolvedValueOnce({
      ...(session.incomingPayment as NonNullable<PaymentSession['incomingPayment']>),
      receivedAmount: session.amount,
      completed: false,
    })
    const { watcher } = watcherFor(openPayments)
    await expect(watcher.waitForCompletion(session)).resolves.toMatchObject({ step: 'completed' })
  })

  it('polls with a growing delay until the money arrives', async () => {
    const { openPayments, session } = await sentPayment()
    const pending = {
      ...(session.incomingPayment as NonNullable<PaymentSession['incomingPayment']>),
    }
    openPayments.getIncomingPayment
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
    const { watcher, waits } = watcherFor(openPayments)
    await expect(watcher.waitForCompletion(session)).resolves.toMatchObject({ step: 'completed' })
    expect(waits).toEqual([1000, 1500, 2250])
  })

  it('reports insufficient funds when the payment fails having sent nothing', async () => {
    const { openPayments, session } = await sentPayment()
    openPayments.getOutgoingPayment.mockResolvedValueOnce(failedOutgoing('0'))
    const { watcher } = watcherFor(openPayments)
    await expect(watcher.waitForCompletion(session)).resolves.toMatchObject({
      step: 'failed',
      failure: 'insufficient_funds',
    })
  })

  it('reports a generic failure when part of the money was sent', async () => {
    const { openPayments, session } = await sentPayment()
    openPayments.getOutgoingPayment.mockResolvedValueOnce(failedOutgoing('50'))
    const { watcher } = watcherFor(openPayments)
    await expect(watcher.waitForCompletion(session)).resolves.toMatchObject({
      failure: 'payment_failed',
    })
  })

  it('times out instead of waiting forever', async () => {
    const { openPayments, session } = await sentPayment()
    const pending = {
      ...(session.incomingPayment as NonNullable<PaymentSession['incomingPayment']>),
    }
    openPayments.getIncomingPayment.mockResolvedValue(pending)
    const { watcher } = watcherFor(openPayments, 5000)
    await expect(watcher.waitForCompletion(session)).resolves.toMatchObject({
      step: 'failed',
      failure: 'timeout',
    })
  })

  it('only watches payments that were sent', async () => {
    const { openPayments, session } = await sentPayment()
    const { watcher } = watcherFor(openPayments)
    await expect(watcher.waitForCompletion({ ...session, step: 'quoted' })).rejects.toMatchObject({
      code: 'invalid_payment_step',
    })
  })
})
