// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import {
  exportPublicKey,
  generateDeviceKeys,
  newNonce,
  signVoucher,
  type TabSummary,
  type VoucherStatus,
} from '@anypay/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSimulatedOffline } from '@/lib/simulated-offline'
import { apiError, fakeApi, SESSION, SHOP } from '@/testing/fakes'
import { approveSale, rememberTab, saveTabKeys } from './customer'
import { acceptVoucher, checkVoucher } from './merchant'
import { applyStatus, backoff, flushOutbox, localRemaining, retryVoucher } from './outbox'
import { getDb, type OutboxRow, resetDb } from './store'

const COP = (value: string) => ({ value, assetCode: 'COP', assetScale: 2 })
const TAB_ID = 'tab4fX9qL2pM'
const NOW = Date.UTC(2026, 9, 15, 12, 0, 0)
const WEEK_START = new Date(NOW - 2 * 24 * 3600_000).toISOString()

const tabSummary: TabSummary = {
  id: TAB_ID,
  shopId: SHOP.id,
  shopName: SHOP.name,
  label: 'Thabo',
  status: 'active',
  cap: { value: '20000', assetCode: 'ZAR', assetScale: 2 },
  shopCap: COP('3700000'),
  remaining: COP('3700000'),
  weekStartedAt: WEEK_START,
}

function outboxRow(changes: Partial<OutboxRow> = {}): OutboxRow {
  return {
    nonce: newNonce(),
    role: 'merchant',
    tabId: TAB_ID,
    shopId: SHOP.id,
    amount: COP('1000'),
    ts: Math.floor(NOW / 1000),
    signature: 'x'.repeat(86),
    state: 'saved',
    idempotencyKey: crypto.randomUUID(),
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: NOW,
    ...changes,
  }
}

beforeEach(async () => {
  await resetDb()
})

afterEach(() => {
  vi.unstubAllGlobals()
  setSimulatedOffline(false)
  localStorage.clear()
})

describe('localRemaining', () => {
  const cap = {
    shopCap: COP('5000'),
    remaining: COP('3000'),
    weekStartedAt: WEEK_START,
    syncedAt: NOW,
  }

  it('takes off vouchers the server had not counted when this phone last synced', () => {
    const rows = [
      outboxRow({ amount: COP('500') }), // never sent
      outboxRow({ amount: COP('700'), ackedAt: NOW + 1 }), // sent after the sync
      outboxRow({ amount: COP('900'), ackedAt: NOW - 1 }), // already in the synced figure
      outboxRow({ amount: COP('400'), state: 'failed' }), // never paid
    ]
    expect(localRemaining(cap, rows, NOW).value).toBe('1800')
  })

  it('starts again from the full cap in a new week', () => {
    const nextWeek = Date.parse(WEEK_START) + 7 * 24 * 3600_000 + 1000
    const rows = [outboxRow({ amount: COP('500'), ts: Math.floor(nextWeek / 1000) })]
    expect(localRemaining(cap, rows, nextWeek).value).toBe('4500')
  })

  it('never goes below zero', () => {
    expect(localRemaining(cap, [outboxRow({ amount: COP('9000') })], NOW).value).toBe('0')
  })
})

describe('applyStatus', () => {
  const status = (changes: Partial<VoucherStatus>): VoucherStatus => ({
    nonce: 'n',
    tabId: TAB_ID,
    amount: COP('1000'),
    status: 'settling',
    ...changes,
  })

  it('maps the server’s answer onto Saved → Sending → Settled | Failed', () => {
    const row = outboxRow()
    expect(applyStatus(row, status({ status: 'settled' }), NOW)).toMatchObject({
      state: 'settled',
      ackedAt: NOW,
    })
    expect(
      applyStatus(row, status({ status: 'rejected', reason: 'cap_reached' }), NOW),
    ).toMatchObject({ state: 'failed', reason: 'cap_reached' })
    expect(applyStatus(row, status({}), NOW)).toMatchObject({
      state: 'sending',
      nextAttemptAt: NOW + backoff(0),
    })
  })

  it('backs off from 2 s to at most 5 minutes', () => {
    expect([0, 1, 2, 10].map(backoff)).toEqual([2000, 4000, 8000, 300_000])
  })
})

describe('an offline sale', () => {
  // Both phones have no signal: nothing may try the network in the background.
  beforeEach(() => {
    setSimulatedOffline(true)
  })

  async function customerWithTab() {
    const keys = await generateDeviceKeys()
    await saveTabKeys(TAB_ID, keys)
    await rememberTab(tabSummary)
    return keys
  }

  async function merchantKnowing(keys: Awaited<ReturnType<typeof generateDeviceKeys>>) {
    await resetDb() // the shop's phone: a different database
    await getDb().shopTabs.put({
      id: TAB_ID,
      shopId: SHOP.id,
      label: 'Thabo',
      publicKey: (await exportPublicKey(keys.publicKey)) as never,
      shopCap: COP('3700000'),
      remaining: COP('3700000'),
      weekStartedAt: WEEK_START,
      syncedAt: NOW,
    })
  }

  const request = (amount = '2500') => ({
    shopId: SHOP.id,
    amount,
    nonce: newNonce(),
    ts: Math.floor(Date.now() / 1000),
  })

  it('is signed on the customer’s phone and checked on the shop’s, both with no signal', async () => {
    const keys = await customerWithTab()
    const approved = await approveSale(request())
    if (!approved.ok) throw new Error(approved.reason)
    expect(await getDb().outbox.get(approved.voucher.nonce)).toMatchObject({
      role: 'customer',
      state: 'saved',
    })

    await merchantKnowing(keys)
    const check = await checkVoucher(approved.voucher, SESSION)
    expect(check.ok).toBe(true)
    if (check.ok) await acceptVoucher(approved.voucher, check.tab)
    expect(await getDb().outbox.get(approved.voucher.nonce)).toMatchObject({
      role: 'merchant',
      state: 'saved',
      amount: COP('2500'),
    })
    // Scanning the same voucher again is caught.
    expect(await checkVoucher(approved.voucher, SESSION)).toEqual({
      ok: false,
      reason: 'duplicate',
    })
  })

  it('is refused on the customer’s phone without a tab at that shop, or over the cap', async () => {
    expect(await approveSale(request())).toEqual({ ok: false, reason: 'no_tab' })
    await customerWithTab()
    expect(await approveSale(request('3700001'))).toEqual({ ok: false, reason: 'cap_reached' })
  })

  it('is refused on the shop’s phone when anything is off', async () => {
    const keys = await customerWithTab()
    const approved = await approveSale(request())
    if (!approved.ok) throw new Error(approved.reason)
    const voucher = approved.voucher
    await merchantKnowing(keys)

    expect(await checkVoucher(voucher, { ...SESSION, shopId: 'OTHERSHP' })).toMatchObject({
      reason: 'other_shop',
    })
    expect(await checkVoucher({ ...voucher, tabId: 'someoneElse1' }, SESSION)).toMatchObject({
      reason: 'unknown_tab',
    })
    expect(await checkVoucher({ ...voucher, amount: '250000' }, SESSION)).toMatchObject({
      reason: 'invalid',
    })
    expect(await checkVoucher(voucher, SESSION, voucher.ts * 1000 + 73 * 3600_000)).toMatchObject({
      reason: 'expired',
    })
    const big = await signVoucher(keys.privateKey, { ...request('3700001'), tabId: TAB_ID })
    expect(await checkVoucher(big, SESSION)).toMatchObject({ reason: 'cap_reached' })
  })
})

describe('flushOutbox', () => {
  const settled: VoucherStatus = {
    nonce: '',
    tabId: TAB_ID,
    amount: COP('1000'),
    status: 'settled',
    paymentId: '70125f46-5c8b-48f5-afea-0b345a6468ad',
  }

  it('sends saved vouchers with their idempotency key and records the outcome', async () => {
    const row = outboxRow()
    await getDb().outbox.put(row)
    const calls = fakeApi({
      [`POST /api/tabs/${TAB_ID}/vouchers`]: { body: { ...settled, nonce: row.nonce } },
    })
    await flushOutbox()
    expect(calls[0]?.headers['Idempotency-Key']).toBe(row.idempotencyKey)
    expect(calls[0]?.body).toMatchObject({ amount: '1000', nonce: row.nonce, shopId: SHOP.id })
    expect(await getDb().outbox.get(row.nonce)).toMatchObject({ state: 'settled' })
  })

  it('keeps everything while offline', async () => {
    setSimulatedOffline(true)
    const row = outboxRow()
    await getDb().outbox.put(row)
    const calls = fakeApi({})
    await flushOutbox()
    expect(calls).toHaveLength(0)
    expect(await getDb().outbox.get(row.nonce)).toMatchObject({ state: 'saved', attempts: 0 })
  })

  it('backs off after a failed attempt, and "Try now" sends at once', async () => {
    const row = outboxRow()
    await getDb().outbox.put(row)
    fakeApi({
      [`POST /api/tabs/${TAB_ID}/vouchers`]: [
        { networkError: true },
        { body: { ...settled, nonce: row.nonce } },
      ],
    })
    await flushOutbox()
    const waiting = await getDb().outbox.get(row.nonce)
    expect(waiting).toMatchObject({ state: 'saved', attempts: 1 })
    expect(waiting?.nextAttemptAt).toBeGreaterThan(Date.now())
    await flushOutbox() // not due yet: nothing sent
    await retryVoucher(row.nonce)
    expect(await getDb().outbox.get(row.nonce)).toMatchObject({ state: 'settled' })
  })

  it('asks for the outcome of a voucher the server is still paying', async () => {
    const row = outboxRow()
    await getDb().outbox.put(row)
    fakeApi({
      [`POST /api/tabs/${TAB_ID}/vouchers`]: {
        body: { ...settled, nonce: row.nonce, status: 'settling' },
      },
      [`GET /api/vouchers/${row.nonce}`]: { body: { ...settled, nonce: row.nonce } },
    })
    await flushOutbox()
    expect(await getDb().outbox.get(row.nonce)).toMatchObject({ state: 'sending' })
    await flushOutbox(Date.now() + backoff(0) + 1)
    expect(await getDb().outbox.get(row.nonce)).toMatchObject({ state: 'settled' })
  })

  it('waits and sends again while the wallet network is down (503), never giving up the sale', async () => {
    const row = outboxRow()
    await getDb().outbox.put(row)
    fakeApi({
      [`POST /api/tabs/${TAB_ID}/vouchers`]: [
        apiError(503, 'open_payments_unavailable'),
        { body: { ...settled, nonce: row.nonce } },
      ],
    })
    await flushOutbox()
    expect(await getDb().outbox.get(row.nonce)).toMatchObject({ state: 'saved', attempts: 1 })
    await flushOutbox(Date.now() + backoff(0) + 1)
    expect(await getDb().outbox.get(row.nonce)).toMatchObject({ state: 'settled' })
  })

  it('sends a voucher again when the server gave it back (its payment never started)', async () => {
    const row = outboxRow()
    await getDb().outbox.put(row)
    fakeApi({
      [`POST /api/tabs/${TAB_ID}/vouchers`]: [
        { body: { ...settled, nonce: row.nonce, status: 'settling' } },
        { body: { ...settled, nonce: row.nonce } },
      ],
      // The server let go of it: asked for its outcome, it no longer knows the voucher.
      [`GET /api/vouchers/${row.nonce}`]: apiError(404, 'voucher_not_found'),
    })
    await flushOutbox()
    await flushOutbox(Date.now() + backoff(0) + 1)
    const resent = await getDb().outbox.get(row.nonce)
    expect(resent).toMatchObject({ state: 'sending' })
    expect(resent?.ackedAt).toBeUndefined()
    await flushOutbox(Date.now() + backoff(5) + 1)
    expect(await getDb().outbox.get(row.nonce)).toMatchObject({ state: 'settled' })
  })

  it('gives up on a voucher the server can never take', async () => {
    const row = outboxRow()
    await getDb().outbox.put(row)
    fakeApi({ [`POST /api/tabs/${TAB_ID}/vouchers`]: apiError(400, 'voucher_invalid') })
    await flushOutbox()
    expect(await getDb().outbox.get(row.nonce)).toMatchObject({
      state: 'failed',
      reason: 'invalid',
    })
  })
})
