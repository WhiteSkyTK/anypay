import type { Money, VoucherStatus } from '@anypay/shared'
import { isOnline } from '@/hooks/useOnlineStatus'
import { api, ApiRequestError } from '@/lib/api'
import { getDb, type OutboxRow } from './store'

const FIRST_RETRY_MS = 2000
const MAX_RETRY_MS = 5 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** 2 s, 4 s, 8 s … up to 5 minutes between tries: quick when signal returns, gentle on data. */
export const backoff = (attempts: number) => Math.min(FIRST_RETRY_MS * 2 ** attempts, MAX_RETRY_MS)

/** What the server's answer means for this phone's copy of the voucher. */
export function applyStatus(row: OutboxRow, status: VoucherStatus, now: number): OutboxRow {
  const acked = { ...row, ackedAt: row.ackedAt ?? now, paymentId: status.paymentId }
  if (status.status === 'settled') return { ...acked, state: 'settled', reason: undefined }
  if (status.status === 'rejected')
    return { ...acked, state: 'failed', reason: status.reason ?? 'payment_failed' }
  // Taken, being paid: ask again later for the outcome.
  return {
    ...acked,
    state: 'sending',
    attempts: row.attempts + 1,
    nextAttemptAt: now + backoff(row.attempts),
  }
}

async function syncOne(row: OutboxRow, now: number): Promise<OutboxRow> {
  try {
    const { tabId, shopId, amount, nonce, ts, signature } = row
    const status =
      row.ackedAt === undefined
        ? await api.submitVoucher(
            tabId,
            { shopId, amount: amount.value, nonce, ts, signature },
            row.idempotencyKey,
          )
        : await api.getVoucher(nonce)
    return applyStatus(row, status, now)
  } catch (error) {
    // The server says it can never take this voucher (bad signature, unknown tab).
    if (error instanceof ApiRequestError && (error.status === 400 || error.status === 404))
      return { ...row, state: 'failed', reason: 'invalid' }
    // No signal, server busy or asleep: try again later.
    return { ...row, attempts: row.attempts + 1, nextAttemptAt: now + backoff(row.attempts) }
  }
}

const waiting = () => getDb().outbox.where('state').anyOf('saved', 'sending')

let running: Promise<void> | undefined
let afterFlush: (() => Promise<void>) | undefined

/** Sends every voucher that is due, one at a time. Calls while one runs share it. */
export function flushOutbox(now = Date.now()): Promise<void> {
  running ??= (async () => {
    if (!isOnline()) return
    const due = await waiting()
      .filter((row) => row.nextAttemptAt <= now)
      .toArray()
    // One at a time on purpose: on a weak connection, parallel uploads only compete.
    for (const row of due) await getDb().outbox.put(await syncOne(row, Date.now())) // NOSONAR
    await afterFlush?.()
  })().finally(() => {
    running = undefined
  })
  return running
}

/** "Try now" on a waiting or failed voucher: send it again at once. */
export async function retryVoucher(nonce: string): Promise<void> {
  const row = await getDb().outbox.get(nonce)
  if (!row || row.state === 'settled') return
  const fresh = row.state === 'failed' ? { ackedAt: undefined, state: 'saved' as const } : {}
  await getDb().outbox.put({ ...row, ...fresh, reason: undefined, nextAttemptAt: 0 })
  await flushOutbox()
}

let timer: ReturnType<typeof setTimeout> | undefined

async function scheduleNext(kick: () => void): Promise<void> {
  clearTimeout(timer)
  const rows = await waiting().toArray()
  if (rows.length === 0) return
  const next = Math.min(...rows.map((row) => row.nextAttemptAt))
  timer = setTimeout(kick, Math.max(next - Date.now(), 1000))
}

/**
 * The SyncManager: flushes when the phone comes online, when the app comes back to the screen,
 * and on a backoff timer. Not the Background Sync API: iOS Safari doesn't have it.
 * `refresh` runs after each flush (e.g. downloading the shop's tabs again).
 */
export function startSync(refresh?: () => Promise<void>): () => void {
  afterFlush = refresh
  const kick = () => void flushOutbox().then(() => scheduleNext(kick))
  const onVisible = () => {
    if (document.visibilityState === 'visible') kick()
  }
  window.addEventListener('online', kick)
  document.addEventListener('visibilitychange', onVisible)
  kick()
  return () => {
    window.removeEventListener('online', kick)
    document.removeEventListener('visibilitychange', onVisible)
    clearTimeout(timer)
    afterFlush = undefined
  }
}

/** A tab's numbers as last synced, for working out what is left offline. */
export interface SyncedCap {
  shopCap: Money
  remaining: Money
  weekStartedAt: string
  syncedAt: number
}

/**
 * What is left of a tab's weekly cap on this phone right now: the synced figure, a fresh cap if
 * a new week has started since, minus vouchers this phone saved that the server hadn't counted
 * yet when it last synced.
 */
export function localRemaining(cap: SyncedCap, outbox: OutboxRow[], at: number): Money {
  const weekStart = Date.parse(cap.weekStartedAt)
  const weeksLater = Math.max(0, Math.floor((at - weekStart) / WEEK_MS))
  const windowStart = weekStart + weeksLater * WEEK_MS
  const base = BigInt(weeksLater > 0 ? cap.shopCap.value : cap.remaining.value)
  const used = outbox
    .filter(
      (row) =>
        row.state !== 'failed' &&
        row.ts * 1000 >= windowStart &&
        (row.ackedAt === undefined || row.ackedAt > cap.syncedAt),
    )
    .reduce((sum, row) => sum + BigInt(row.amount.value), 0n)
  const left = base - used
  return { ...cap.shopCap, value: (left > 0n ? left : 0n).toString() }
}

let stopSync: (() => void) | undefined

/** Starts the SyncManager once per page load; screens that use tabs call this on mount. */
export function ensureSync(refresh?: () => Promise<void>): void {
  stopSync ??= startSync(refresh)
}
