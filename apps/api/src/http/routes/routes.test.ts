import {
  CreatePaymentResponseSchema,
  CreateShopResponseSchema,
  PaymentSummarySchema,
  ShopPaymentsResponseSchema,
} from '@anypay/shared'
import type { Express } from 'express'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app'
import { parseEnv } from '../../config/env'
import { createContainer } from '../../container'
import type { DatabaseHandle } from '../../db/database'
import { computeInteractHash } from '../../open-payments/interact-hash'
import {
  createFakeOpenPayments,
  customerWallet,
  merchantWallet,
} from '../../testing/fake-open-payments'
import { openTestDatabase } from '../../testing/test-database'

const WEB_ORIGIN = 'http://localhost:5173'
const env = parseEnv({ NODE_ENV: 'test', WEB_ORIGIN, PUBLIC_API_URL: 'http://localhost:3000' })

let database: DatabaseHandle
let openPayments: ReturnType<typeof createFakeOpenPayments>
let app: Express

beforeAll(async () => {
  database = await openTestDatabase()
  openPayments = createFakeOpenPayments()
  app = createApp(createContainer(env, database.db, { openPayments }), { rateLimitPerMinute: 1000 })
})
afterAll(() => database.close())

const key = () => randomUUID()

async function createShop(name = 'Mama T Spaza') {
  const res = await request(app)
    .post('/api/shops')
    .set('Idempotency-Key', key())
    .send({ name, walletAddress: '$ilp.interledger-test.dev/merchanttest' })
    .expect(201)
  return CreateShopResponseSchema.parse(res.body)
}

async function startPayment(shopId: string, amount = '25.50') {
  const res = await request(app)
    .post(`/api/shops/${shopId}/payments`)
    .set('Idempotency-Key', key())
    .send({ amount, customerWallet: '$ilp.interledger-test.dev/southtest' })
    .expect(201)
  return CreatePaymentResponseSchema.parse(res.body)
}

/** The callback query the customer's wallet would send for the latest consent request. */
function approvalQuery(interactRef = 'ref-1') {
  const grantCall = openPayments.requestGrant.mock.calls.findLast(
    ([, req]) => req.type === 'outgoing-payment',
  )
  const grantRequest = grantCall?.[1]
  if (grantRequest?.type !== 'outgoing-payment' || !grantRequest.finish)
    throw new Error('no consent')
  const hash = computeInteractHash({
    clientNonce: grantRequest.finish.nonce,
    interactNonce: 'as-nonce',
    interactRef,
    grantEndpoint: customerWallet.authServer,
  })
  return { interact_ref: interactRef, hash }
}

describe('merchant onboarding', () => {
  it('looks up a wallet address before creating the shop', async () => {
    const res = await request(app)
      .post('/api/wallet-addresses/lookup')
      .send({ walletAddress: '$ilp.interledger-test.dev/merchanttest' })
      .expect(200)
    expect(res.body).toEqual({
      walletAddress: merchantWallet.id,
      publicName: 'Merchant Test',
      assetCode: 'COP',
      assetScale: 2,
    })
  })

  it('explains a malformed wallet address with a translatable message', async () => {
    const res = await request(app)
      .post('/api/wallet-addresses/lookup')
      .send({ walletAddress: 'merchanttest' })
      .expect(400)
    expect(res.body.error).toEqual({
      code: 'invalid_request',
      message: 'errors.walletAddress.format',
    })
  })

  it('refuses wallets on hosts that are not allowed', async () => {
    const res = await request(app)
      .post('/api/wallet-addresses/lookup')
      .send({ walletAddress: 'https://evil.example/shop' })
      .expect(400)
    expect(res.body.error.code).toBe('wallet_host_not_allowed')
  })

  it('creates a shop in the wallet’s currency and returns a merchant token once', async () => {
    const { shop, merchantToken } = await createShop()
    expect(shop).toMatchObject({
      name: 'Mama T Spaza',
      walletAddress: merchantWallet.id,
      assetCode: 'COP',
    })
    expect(shop.id).toMatch(/^[\w-]{8}$/)
    expect(merchantToken.length).toBeGreaterThanOrEqual(40)
    const publicView = await request(app).get(`/api/shops/${shop.id}`).expect(200)
    expect(publicView.body).toEqual(shop)
    expect(JSON.stringify(publicView.body)).not.toContain(merchantToken)
  })

  it('requires an Idempotency-Key to create a shop', async () => {
    const res = await request(app)
      .post('/api/shops')
      .send({ name: 'No Key Spaza', walletAddress: '$ilp.interledger-test.dev/merchanttest' })
      .expect(400)
    expect(res.body.error.code).toBe('idempotency_key_required')
  })

  it('replays the original response when a retry reuses the key', async () => {
    const idempotencyKey = key()
    const body = { name: 'Retry Spaza', walletAddress: '$ilp.interledger-test.dev/merchanttest' }
    const first = await request(app)
      .post('/api/shops')
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
    const retry = await request(app)
      .post('/api/shops')
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
    expect(retry.status).toBe(201)
    expect(retry.headers['idempotent-replayed']).toBe('true')
    expect(retry.body).toEqual(first.body)
  })

  it('refuses a reused key with a different request', async () => {
    const idempotencyKey = key()
    const wallet = '$ilp.interledger-test.dev/merchanttest'
    await request(app)
      .post('/api/shops')
      .set('Idempotency-Key', idempotencyKey)
      .send({ name: 'One', walletAddress: wallet })
    const res = await request(app)
      .post('/api/shops')
      .set('Idempotency-Key', idempotencyKey)
      .send({ name: 'Two', walletAddress: wallet })
      .expect(422)
    expect(res.body.error.code).toBe('idempotency_key_reused')
  })

  it('returns 404 for an unknown shop', async () => {
    const res = await request(app).get('/api/shops/nope').expect(404)
    expect(res.body.error.code).toBe('shop_not_found')
  })
})

describe('customer payment', () => {
  it('quotes the payment and returns the wallet approval link', async () => {
    const { shop } = await createShop()
    const { payment, quote, consentUrl } = await startPayment(shop.id)
    expect(payment).toMatchObject({
      shopId: shop.id,
      shopName: shop.name,
      status: 'awaiting-consent',
      amount: { value: '2550', assetCode: 'COP', assetScale: 2 },
    })
    expect(quote?.debitAmount).toEqual({ value: '105', assetCode: 'ZAR', assetScale: 2 })
    expect(consentUrl).toContain('grant-interactions')
    // The callback the wallet will use points at this payment on our public API URL.
    const grant = openPayments.requestGrant.mock.calls.at(-1)?.[1]
    expect(grant).toMatchObject({
      finish: { uri: `http://localhost:3000/api/payments/${payment.id}/callback` },
    })
  })

  it('validates the amount', async () => {
    const { shop } = await createShop()
    const res = await request(app)
      .post(`/api/shops/${shop.id}/payments`)
      .set('Idempotency-Key', key())
      .send({ amount: '12abc', customerWallet: '$ilp.interledger-test.dev/southtest' })
      .expect(400)
    expect(res.body.error.message).toBe('errors.money.invalid')
  })

  it('verifies the approval, sends the payment and completes it in the background', async () => {
    const { shop, merchantToken } = await createShop()
    const { payment } = await startPayment(shop.id)
    const res = await request(app)
      .get(`/api/payments/${payment.id}/callback`)
      .query(approvalQuery())
      .expect(303)
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/receipt/${payment.id}`)

    await vi.waitFor(async () => {
      const receipt = await request(app).get(`/api/payments/${payment.id}`).expect(200)
      expect(PaymentSummarySchema.parse(receipt.body).status).toBe('completed')
    })

    const feed = await request(app)
      .get(`/api/shops/${shop.id}/payments`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    const { payments, total } = ShopPaymentsResponseSchema.parse(feed.body)
    expect(payments[0]).toMatchObject({ id: payment.id, status: 'completed' })
    expect(total).toEqual({ value: '2550', assetCode: 'COP', assetScale: 2 })
  })

  it('handles the callback only once', async () => {
    const { shop } = await createShop()
    const { payment } = await startPayment(shop.id)
    const query = approvalQuery()
    const continuesBefore = openPayments.continueGrant.mock.calls.length
    await request(app).get(`/api/payments/${payment.id}/callback`).query(query).expect(303)
    await request(app).get(`/api/payments/${payment.id}/callback`).query(query).expect(303)
    expect(openPayments.continueGrant.mock.calls.length - continuesBefore).toBe(1)
  })

  it('records a declined approval', async () => {
    const { shop } = await createShop()
    const { payment } = await startPayment(shop.id)
    await request(app)
      .get(`/api/payments/${payment.id}/callback`)
      .query({ result: 'grant_rejected' })
      .expect(303)
    const receipt = await request(app).get(`/api/payments/${payment.id}`).expect(200)
    expect(receipt.body).toMatchObject({ status: 'failed', failure: 'consent_declined' })
  })

  it('rejects a forged approval without sending money', async () => {
    const { shop } = await createShop()
    const { payment } = await startPayment(shop.id)
    const outgoingBefore = openPayments.createOutgoingPayment.mock.calls.length
    await request(app)
      .get(`/api/payments/${payment.id}/callback`)
      .query({ interact_ref: 'ref-1', hash: 'forged' })
      .expect(303)
    const receipt = await request(app).get(`/api/payments/${payment.id}`).expect(200)
    expect(receipt.body).toMatchObject({ status: 'failed', failure: 'consent_invalid' })
    expect(openPayments.createOutgoingPayment.mock.calls).toHaveLength(outgoingBefore)
  })

  it('sends the customer to the receipt even when the wallet is unreachable', async () => {
    const { shop } = await createShop()
    const { payment } = await startPayment(shop.id)
    openPayments.continueGrant.mockRejectedValueOnce(new Error('network down'))
    const res = await request(app)
      .get(`/api/payments/${payment.id}/callback`)
      .query(approvalQuery())
      .expect(303)
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/receipt/${payment.id}?error=callback`)
  })

  it('returns 404 for unknown or malformed payment ids', async () => {
    await request(app).get(`/api/payments/${randomUUID()}`).expect(404)
    await request(app).get('/api/payments/not-a-uuid/callback').expect(404)
  })
})

describe('merchant feed', () => {
  it('requires the merchant token', async () => {
    const { shop } = await createShop()
    const missing = await request(app).get(`/api/shops/${shop.id}/payments`).expect(401)
    expect(missing.body.error.code).toBe('merchant_unauthorized')
    await request(app)
      .get(`/api/shops/${shop.id}/payments`)
      .set('Authorization', 'Bearer wrong-token')
      .expect(401)
  })

  it('exports completed payments as CSV', async () => {
    const { shop, merchantToken } = await createShop()
    const { payment } = await startPayment(shop.id, '10')
    await request(app).get(`/api/payments/${payment.id}/callback`).query(approvalQuery())
    await vi.waitFor(async () => {
      const receipt = await request(app).get(`/api/payments/${payment.id}`)
      expect(receipt.body.status).toBe('completed')
    })
    const res = await request(app)
      .get(`/api/shops/${shop.id}/export.csv`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain(`anypay-${shop.id}-`)
    const lines = res.text.trim().split('\r\n')
    expect(lines[0]).toBe('completed_at,amount,currency,customer_paid,customer_currency,payment_id')
    expect(lines[1]).toMatch(new RegExp(`,10\\.00,COP,1\\.05,ZAR,${payment.id}$`))
  })
})

/** Reads Server-Sent Events from a real socket until `done` says stop. */
type SseEvent = { event: string; data: unknown }

async function readEvents(
  path: string,
  done: (events: SseEvent[]) => boolean,
  onEvent?: (event: SseEvent) => void,
) {
  const server = app.listen(0)
  const { port } = server.address() as AddressInfo
  const controller = new AbortController()
  const events: SseEvent[] = []
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { signal: controller.signal })
    const reader = res.body?.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    while (reader && !done(events)) {
      const { value, done: ended } = await reader.read()
      if (ended) break
      buffer += value
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''
      for (const block of blocks) {
        const event = /^event: (.+)$/m.exec(block)?.[1]
        const data = /^data: (.+)$/m.exec(block)?.[1]
        if (!event || !data) continue
        const parsed = { event, data: JSON.parse(data) as unknown }
        events.push(parsed)
        onEvent?.(parsed)
      }
    }
    return events
  } finally {
    controller.abort()
    server.close()
  }
}

describe('live updates (SSE)', () => {
  it('sends the merchant a snapshot, then each new payment', async () => {
    const { shop, merchantToken } = await createShop()
    // Pay only once the snapshot arrived, so the subscription is definitely live.
    const events = await readEvents(
      `/api/shops/${shop.id}/events?token=${merchantToken}`,
      (received) => received.some((e) => e.event === 'payment'),
      (event) => {
        if (event.event === 'snapshot') void startPayment(shop.id, '7')
      },
    )
    expect(events[0]?.event).toBe('snapshot')
    expect(events.find((e) => e.event === 'payment')?.data).toMatchObject({
      shopId: shop.id,
      amount: { value: '700' },
    })
  })

  it('refuses the merchant stream without the token', async () => {
    const { shop } = await createShop()
    await request(app).get(`/api/shops/${shop.id}/events`).expect(401)
  })

  it('sends a finished payment’s receipt once and closes', async () => {
    const { shop } = await createShop()
    const { payment } = await startPayment(shop.id)
    await request(app)
      .get(`/api/payments/${payment.id}/callback`)
      .query({ result: 'grant_rejected' })
    const events = await readEvents(`/api/payments/${payment.id}/events`, () => false)
    expect(events).toHaveLength(1)
    expect(events[0]?.data).toMatchObject({ status: 'failed', failure: 'consent_declined' })
  })
})

describe('rate limits', () => {
  it('limits wallet lookups per client', async () => {
    const limited = createApp(createContainer(env, database.db, { openPayments }), {
      rateLimitPerMinute: 2,
    })
    const lookup = () =>
      request(limited)
        .post('/api/wallet-addresses/lookup')
        .send({ walletAddress: '$ilp.interledger-test.dev/merchanttest' })
    await lookup().expect(200)
    await lookup().expect(200)
    const res = await lookup().expect(429)
    expect(res.body.error.code).toBe('rate_limited')
  })
})

describe('config', () => {
  it('tells the web app whether to show the demo banner', async () => {
    const res = await request(app).get('/api/config').expect(200)
    expect(res.body).toEqual({ demoMode: false, version: '0.1.0' })
  })
})
