import {
  CreateShopResponseSchema,
  type DeviceKeys,
  exportPublicKey,
  generateDeviceKeys,
  newNonce,
  OpenTabResponseSchema,
  ShopPaymentsResponseSchema,
  ShopTabsResponseSchema,
  signVoucher,
  TabSummarySchema,
  type Voucher,
  VoucherStatusSchema,
} from '@anypay/shared'
import type { Express } from 'express'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app'
import { parseEnv } from '../../config/env'
import { createContainer } from '../../container'
import type { DatabaseHandle } from '../../db/database'
import { computeInteractHash } from '../../open-payments/interact-hash'
import { OpenPaymentsError } from '../../open-payments/errors'
import { createFakeOpenPayments, customerWallet, FAKE_RATE } from '../../testing/fake-open-payments'
import { openTestDatabase } from '../../testing/test-database'

const WEB_ORIGIN = 'http://localhost:5173'
const env = parseEnv({ NODE_ENV: 'test', WEB_ORIGIN, PUBLIC_API_URL: 'http://localhost:3000' })
// R200 a week; in the fake wallet R 1,00 buys COP 185,00, so the shop's cap is COP 37 000,00.
const SHOP_CAP = String(20_000 * FAKE_RATE)

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

/** The callback query the customer's wallet sends after they approve the latest grant. */
function approvalQuery(interactRef = 'ref-1') {
  const grantCall = openPayments.requestGrant.mock.calls.findLast(
    ([, req]) => req.type === 'outgoing-payment',
  )
  const grantRequest = grantCall?.[1]
  if (grantRequest?.type !== 'outgoing-payment' || !grantRequest.finish) throw new Error('no grant')
  const hash = computeInteractHash({
    clientNonce: grantRequest.finish.nonce,
    interactNonce: 'as-nonce',
    interactRef,
    grantEndpoint: customerWallet.authServer,
  })
  return { interact_ref: interactRef, hash }
}

interface OpenTab {
  shopId: string
  merchantToken: string
  tabId: string
  keys: DeviceKeys
}

/** A shop, and a customer's tab there approved in their wallet (what happens online, once). */
async function openApprovedTab(): Promise<OpenTab> {
  const shopRes = await request(app)
    .post('/api/shops')
    .set('Idempotency-Key', key())
    .send({ name: 'Mama T Spaza', walletAddress: '$ilp.interledger-test.dev/merchanttest' })
    .expect(201)
  const { shop, merchantToken } = CreateShopResponseSchema.parse(shopRes.body)
  const keys = await generateDeviceKeys()
  const tabRes = await request(app)
    .post(`/api/shops/${shop.id}/tabs`)
    .set('Idempotency-Key', key())
    .send({
      customerWallet: '$ilp.interledger-test.dev/southtest',
      weeklyCap: '200',
      label: 'Thabo',
      publicKey: await exportPublicKey(keys.publicKey),
    })
    .expect(201)
  const { tab } = OpenTabResponseSchema.parse(tabRes.body)
  await request(app).get(`/api/tabs/${tab.id}/callback`).query(approvalQuery()).expect(303)
  return { shopId: shop.id, merchantToken, tabId: tab.id, keys }
}

async function voucherFor(tab: OpenTab, amount: string, changes: Partial<Voucher> = {}) {
  return signVoucher(tab.keys.privateKey, {
    tabId: tab.tabId,
    shopId: tab.shopId,
    amount,
    nonce: newNonce(),
    ts: Math.floor(Date.now() / 1000),
    ...changes,
  })
}

/** What either phone does when it gets signal. */
function sync(voucher: Voucher) {
  const { tabId, signature, ...rest } = voucher
  return request(app)
    .post(`/api/tabs/${tabId}/vouchers`)
    .set('Idempotency-Key', key())
    .send({ ...rest, signature })
}

async function settled(nonce: string) {
  await expect
    .poll(async () => (await request(app).get(`/api/vouchers/${nonce}`)).body.status)
    .toBe('settled')
}

describe('opening a tab', () => {
  it('asks the customer’s wallet for a grant capped per week, then activates the tab', async () => {
    const shopRes = await request(app)
      .post('/api/shops')
      .set('Idempotency-Key', key())
      .send({ name: 'Kasi Corner', walletAddress: '$ilp.interledger-test.dev/merchanttest' })
    const { shop } = CreateShopResponseSchema.parse(shopRes.body)
    const keys = await generateDeviceKeys()
    const res = await request(app)
      .post(`/api/shops/${shop.id}/tabs`)
      .set('Idempotency-Key', key())
      .send({
        customerWallet: '$ilp.interledger-test.dev/southtest',
        weeklyCap: '200',
        label: 'Thabo',
        publicKey: await exportPublicKey(keys.publicKey),
      })
      .expect(201)
    const { tab, consentUrl } = OpenTabResponseSchema.parse(res.body)
    expect(tab).toMatchObject({
      status: 'awaiting-consent',
      label: 'Thabo',
      shopName: 'Kasi Corner',
    })
    expect(tab.cap).toEqual({ value: '20000', assetCode: 'ZAR', assetScale: 2 })
    expect(consentUrl).toMatch(/^https:\/\//)
    const grant = openPayments.requestGrant.mock.calls.at(-1)?.[1]
    expect(grant).toMatchObject({
      type: 'outgoing-payment',
      debitAmount: { value: '20000', assetCode: 'ZAR' },
      interval: expect.stringMatching(/^R\/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\/P1W$/),
      finish: { uri: `http://localhost:3000/api/tabs/${tab.id}/callback` },
    })

    const callback = await request(app)
      .get(`/api/tabs/${tab.id}/callback`)
      .query(approvalQuery())
      .expect(303)
    expect(callback.headers.location).toBe(`${WEB_ORIGIN}/tab/${tab.id}`)
    const active = TabSummarySchema.parse((await request(app).get(`/api/tabs/${tab.id}`)).body)
    expect(active.status).toBe('active')
    expect(active.shopCap).toEqual({ value: SHOP_CAP, assetCode: 'COP', assetScale: 2 })
    expect(active.remaining?.value).toBe(SHOP_CAP)
  })

  it('records a declined approval', async () => {
    const shopRes = await request(app)
      .post('/api/shops')
      .set('Idempotency-Key', key())
      .send({ name: 'Kasi Corner', walletAddress: '$ilp.interledger-test.dev/merchanttest' })
    const { shop } = CreateShopResponseSchema.parse(shopRes.body)
    const keys = await generateDeviceKeys()
    const res = await request(app)
      .post(`/api/shops/${shop.id}/tabs`)
      .set('Idempotency-Key', key())
      .send({
        customerWallet: '$ilp.interledger-test.dev/southtest',
        weeklyCap: '50',
        label: 'Lerato',
        publicKey: await exportPublicKey(keys.publicKey),
      })
    const { tab } = OpenTabResponseSchema.parse(res.body)
    await request(app).get(`/api/tabs/${tab.id}/callback`).query({ result: 'grant_rejected' })
    const declined = TabSummarySchema.parse((await request(app).get(`/api/tabs/${tab.id}`)).body)
    expect(declined).toMatchObject({ status: 'failed', failure: 'consent_declined' })
  })

  it('gives the shop’s phone what it needs to check vouchers offline', async () => {
    const tab = await openApprovedTab()
    const res = await request(app)
      .get(`/api/shops/${tab.shopId}/tabs`)
      .set('Authorization', `Bearer ${tab.merchantToken}`)
      .expect(200)
    const { tabs } = ShopTabsResponseSchema.parse(res.body)
    expect(tabs).toEqual([
      expect.objectContaining({
        id: tab.tabId,
        label: 'Thabo',
        publicKey: await exportPublicKey(tab.keys.publicKey),
        remaining: { value: SHOP_CAP, assetCode: 'COP', assetScale: 2 },
      }),
    ])
    await request(app).get(`/api/shops/${tab.shopId}/tabs`).expect(401)
  })
})

describe('settling vouchers', () => {
  it('settles a valid voucher with the tab’s grant, and it lands in the shop’s feed', async () => {
    const tab = await openApprovedTab()
    const voucher = await voucherFor(tab, '5000')
    const res = await sync(voucher).expect(200)
    expect(VoucherStatusSchema.parse(res.body)).toMatchObject({
      nonce: voucher.nonce,
      amount: { value: '5000', assetCode: 'COP' },
    })
    await settled(voucher.nonce)

    const feed = await request(app)
      .get(`/api/shops/${tab.shopId}/payments`)
      .set('Authorization', `Bearer ${tab.merchantToken}`)
    const { payments } = ShopPaymentsResponseSchema.parse(feed.body)
    expect(payments[0]).toMatchObject({ tabId: tab.tabId, status: 'completed' })
    const summary = TabSummarySchema.parse((await request(app).get(`/api/tabs/${tab.tabId}`)).body)
    expect(summary.remaining?.value).toBe(String(BigInt(SHOP_CAP) - 5000n))
  })

  it('settles exactly once when both phones sync the same voucher', async () => {
    const tab = await openApprovedTab()
    const voucher = await voucherFor(tab, '2500')
    const sentBefore = openPayments.createOutgoingPayment.mock.calls.length
    const [merchantPhone, customerPhone] = await Promise.all([sync(voucher), sync(voucher)])
    expect(merchantPhone.status).toBe(200)
    expect(customerPhone.status).toBe(200)
    await settled(voucher.nonce)
    const later = await sync(voucher).expect(200)
    expect(later.body.status).toBe('settled')
    expect(openPayments.createOutgoingPayment.mock.calls.length - sentBefore).toBe(1)
  })

  it('refuses a voucher whose amount was changed after signing', async () => {
    const tab = await openApprovedTab()
    const voucher = await voucherFor(tab, '2500')
    const res = await sync({ ...voucher, amount: '250000' }).expect(400)
    expect(res.body.error.code).toBe('voucher_invalid')
  })

  it('refuses a reused nonce on a different sale', async () => {
    const tab = await openApprovedTab()
    const first = await voucherFor(tab, '1000')
    await sync(first).expect(200)
    // A replay with a new amount can't carry a valid signature; a re-sign with the same nonce is
    // the same sale only if everything matches.
    const replay = await voucherFor(tab, '9000', { nonce: first.nonce, ts: first.ts })
    const res = await sync(replay).expect(200)
    expect(res.body).toMatchObject({ nonce: first.nonce, amount: { value: '1000' } })
  })

  it('rejects a voucher over what is left of the weekly cap', async () => {
    const tab = await openApprovedTab()
    const voucher = await voucherFor(tab, String(BigInt(SHOP_CAP) + 1n))
    const res = await sync(voucher).expect(200)
    expect(res.body).toMatchObject({ status: 'rejected', reason: 'cap_reached' })
  })

  it('rejects a voucher older than 72 hours', async () => {
    const tab = await openApprovedTab()
    const voucher = await voucherFor(tab, '1000', {
      ts: Math.floor(Date.now() / 1000) - 73 * 60 * 60,
    })
    const res = await sync(voucher).expect(200)
    expect(res.body).toMatchObject({ status: 'rejected', reason: 'expired' })
  })

  it('rotates an expired grant token once, then settles', async () => {
    const tab = await openApprovedTab()
    openPayments.createOutgoingPayment.mockRejectedValueOnce(
      new OpenPaymentsError('token_expired', 'Token expired'),
    )
    const rotationsBefore = openPayments.rotateToken.mock.calls.length
    const voucher = await voucherFor(tab, '1500')
    await sync(voucher).expect(200)
    await settled(voucher.nonce)
    expect(openPayments.rotateToken.mock.calls.length - rotationsBefore).toBe(1)
  })

  it('answers "not found" for unknown tabs and vouchers', async () => {
    const tab = await openApprovedTab()
    const voucher = await voucherFor(tab, '1000')
    await sync({ ...voucher, tabId: 'unknownTab12' }).expect(404)
    await request(app).get('/api/vouchers/unknownNonce1').expect(404)
    await request(app).get('/api/tabs/not-a-tab').expect(404)
  })
})
