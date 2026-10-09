import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '../db/database'
import type { PaymentSession } from '../services/payment-session'
import { customerWallet, merchantWallet } from '../testing/fake-open-payments'
import { openTestDatabase, rowsOf, testCipher } from '../testing/test-database'
import { IdempotencyRepository } from './idempotency-repository'
import { PaymentRepository } from './payment-repository'
import { ShopRepository } from './shop-repository'

let handle: DatabaseHandle
let shops: ShopRepository
let paymentsRepo: PaymentRepository
let idempotency: IdempotencyRepository

beforeAll(async () => {
  handle = await openTestDatabase()
  shops = new ShopRepository(handle.db)
  paymentsRepo = new PaymentRepository(handle.db, testCipher())
  idempotency = new IdempotencyRepository(handle.db, testCipher())
  await shops.create({
    id: 'shop-1',
    name: 'Mama T Spaza',
    walletAddress: merchantWallet.id,
    assetCode: 'COP',
    assetScale: 2,
    merchantTokenHash: 'hash',
  })
})
afterAll(() => handle.close())

const session = (changes: Partial<PaymentSession> = {}): PaymentSession => ({
  id: randomUUID(),
  step: 'quoted',
  customer: customerWallet,
  merchant: merchantWallet,
  amount: { value: '2550', assetCode: 'COP', assetScale: 2 },
  quote: {
    id: 'q-1',
    walletAddress: customerWallet.id,
    receiver: 'https://ilp.interledger-test.dev/x/incoming-payments/1',
    debitAmount: { value: '105', assetCode: 'ZAR', assetScale: 2 },
    receiveAmount: { value: '2550', assetCode: 'COP', assetScale: 2 },
  },
  incomingAccess: {
    accessToken: { value: 'secret-access-token', manage: 'https://auth/manage' },
    continuation: { uri: 'https://auth/continue', accessToken: 'secret-continue', waitSeconds: 0 },
  },
  ...changes,
})

describe('ShopRepository', () => {
  it('finds a shop by id', async () => {
    await expect(shops.findById('shop-1')).resolves.toMatchObject({ name: 'Mama T Spaza' })
    await expect(shops.findById('nope')).resolves.toBeUndefined()
  })
})

describe('PaymentRepository', () => {
  it('stores the session encrypted and reads it back', async () => {
    const original = session()
    await paymentsRepo.insert('shop-1', original)
    const stored = await paymentsRepo.find(original.id)
    expect(stored?.session).toEqual(original)
    expect(stored?.record).toMatchObject({
      status: 'quoted',
      amount: original.amount,
      debitAmount: { value: '105', assetCode: 'ZAR', assetScale: 2 },
    })
  })

  it('never writes grant tokens or the customer wallet in clear text', async () => {
    const original = session()
    await paymentsRepo.insert('shop-1', original)
    const raw = await handle.db.execute(sql`SELECT * FROM payments WHERE id = ${original.id}`)
    const rowText = JSON.stringify(rowsOf(raw))
    expect(rowText).not.toContain('secret-access-token')
    expect(rowText).not.toContain('secret-continue')
    expect(rowText).not.toContain(customerWallet.id)
  })

  it('updates status and stamps completion', async () => {
    const original = session({ step: 'sending' })
    await paymentsRepo.insert('shop-1', original)
    const done = await paymentsRepo.update({ ...original, step: 'completed' })
    expect(done.status).toBe('completed')
    expect(done.completedAt).toBeInstanceOf(Date)
  })

  it('lists a shop’s payments since a moment, newest first, without decrypting', async () => {
    const list = await paymentsRepo.listForShop('shop-1', new Date(Date.now() - 60_000))
    expect(list.length).toBeGreaterThanOrEqual(3)
    expect(list[0]?.createdAt.getTime()).toBeGreaterThanOrEqual(
      list.at(-1)?.createdAt.getTime() ?? 0,
    )
    await expect(
      paymentsRepo.listForShop('shop-1', new Date(Date.now() + 60_000)),
    ).resolves.toEqual([])
  })

  it('finds sessions by status (to resume watching after a restart)', async () => {
    const sending = session({ step: 'sending' })
    await paymentsRepo.insert('shop-1', sending)
    const found = await paymentsRepo.findSessionsByStatus('sending')
    expect(found.map((s) => s.id)).toContain(sending.id)
  })

  it('cannot read sessions sealed with another key', async () => {
    const original = session()
    await paymentsRepo.insert('shop-1', original)
    const otherKey = new PaymentRepository(handle.db, testCipher())
    await expect(otherKey.find(original.id)).rejects.toMatchObject({
      code: 'stored_data_unreadable',
    })
  })
})

describe('IdempotencyRepository', () => {
  it('starts once, then replays the stored response', async () => {
    await expect(idempotency.begin('payments', 'k-1', 'h')).resolves.toEqual({ kind: 'started' })
    await expect(idempotency.begin('payments', 'k-1', 'h')).resolves.toEqual({
      kind: 'in_progress',
    })
    await idempotency.complete('payments', 'k-1', 201, '{"ok":true}')
    await expect(idempotency.begin('payments', 'k-1', 'h')).resolves.toEqual({
      kind: 'replay',
      statusCode: 201,
      body: '{"ok":true}',
    })
  })

  it('refuses the same key with a different request', async () => {
    await idempotency.begin('payments', 'k-2', 'h1')
    await expect(idempotency.begin('payments', 'k-2', 'h2')).resolves.toEqual({ kind: 'mismatch' })
  })

  it('keeps keys separate per scope', async () => {
    await idempotency.begin('shops', 'k-3', 'h')
    await expect(idempotency.begin('payments', 'k-3', 'h')).resolves.toEqual({ kind: 'started' })
  })

  it('forgets an abandoned key so a retry runs again', async () => {
    await idempotency.begin('payments', 'k-4', 'h')
    await idempotency.abandon('payments', 'k-4')
    await expect(idempotency.begin('payments', 'k-4', 'h')).resolves.toEqual({ kind: 'started' })
  })

  it('never stores a response (e.g. a new merchant token) in plain text', async () => {
    await idempotency.begin('shops', 'k-5', 'h')
    await idempotency.complete('shops', 'k-5', 201, '{"merchantToken":"secret-token"}')
    const rows = rowsOf<{ response_body: string }>(
      await handle.db.execute(sql`SELECT response_body FROM idempotency_keys WHERE key = 'k-5'`),
    )
    expect(rows[0]?.response_body).not.toContain('secret-token')
  })

  it('purges records older than the cutoff', async () => {
    await idempotency.begin('shops', 'k-old', 'h')
    await handle.db.execute(
      sql`UPDATE idempotency_keys SET created_at = now() - interval '2 days' WHERE key = 'k-old'`,
    )
    const removed = await idempotency.purgeOlderThan(new Date(Date.now() - 86_400_000))
    expect(removed).toBe(1)
    await expect(idempotency.begin('shops', 'k-old', 'h')).resolves.toEqual({ kind: 'started' })
  })
})
