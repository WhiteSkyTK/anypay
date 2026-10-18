import {
  type Money,
  type PaymentSummary,
  PaymentSummarySchema,
  ShopPaymentsResponseSchema,
  zeroMoney,
} from '@anypay/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod/mini'
import { api, ApiRequestError } from '@/lib/api'
import { readCache, writeCache } from '@/lib/cache'
import { startOfToday } from '@/lib/format'
import type { MerchantSession } from '@/lib/merchant-session'
import { signOutOtherPhones } from '@/lib/merchant-token'
import { type StreamState, useEventSource } from './useEventSource'

export type FeedState = StreamState | 'loading' | 'unauthorized'

export interface LiveFeed {
  state: FeedState
  /** False until the first snapshot: show skeletons, not "no payments". */
  loaded: boolean
  payments: PaymentSummary[]
  total: Money
}

// Today's feed on this phone: shown at once when the feed opens, before the live connection is up.
const CachedFeedSchema = z.extend(ShopPaymentsResponseSchema, { day: z.string() })
type CachedFeed = z.infer<typeof CachedFeedSchema>

function cachedToday(shopId: string, day: string): CachedFeed | undefined {
  const cached = readCache(`feed.${shopId}`, CachedFeedSchema)
  return cached?.day === day ? cached : undefined
}

function upsert(list: PaymentSummary[], payment: PaymentSummary): PaymentSummary[] {
  const rest = list.filter((existing) => existing.id !== payment.id)
  return [payment, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

type FeedAccess =
  | { kind: 'open'; url: string }
  | { kind: 'signed-out' }
  /** The API didn't answer (asleep, restarting, no signal): ask again later. */
  | { kind: 'unreachable' }
  /** The phone just finished switching tokens: the new session asks for its own ticket. */
  | { kind: 'renewed' }

const refused = (error: unknown, statuses: number[]) =>
  error instanceof ApiRequestError && statuses.includes(error.status)

/**
 * A one-minute ticket to open the feed with: the merchant token travels in a header, never in the
 * feed's URL. A refused token signs the phone out, unless "Sign out other phones" went through
 * without this phone hearing back; then it finishes the change with the token it chose.
 */
async function feedAccess(session: MerchantSession, since: Date): Promise<FeedAccess> {
  try {
    const { ticket } = await api.streamTicket(session.shopId, session.token)
    return { kind: 'open', url: api.shopEventsUrl(session.shopId, ticket, since) }
  } catch (error) {
    if (!refused(error, [401, 404])) return { kind: 'unreachable' }
    if (refused(error, [404]) || !session.nextToken) return { kind: 'signed-out' }
  }
  try {
    await signOutOtherPhones(session)
    return { kind: 'renewed' }
  } catch (error) {
    return refused(error, [401]) ? { kind: 'signed-out' } : { kind: 'unreachable' }
  }
}

const FIRST_RETRY_MS = 2000
const MAX_RETRY_MS = 30_000

/**
 * Today's payments for the shop on this phone, pushed live over SSE (the phone never polls).
 * After any reconnect the server sends a fresh snapshot, so nothing is missed while offline.
 */
export function useLiveFeed(
  session: MerchantSession,
  onNewPayment?: (payment: PaymentSummary) => void,
): LiveFeed {
  const since = useMemo(() => startOfToday(), [])
  const day = since.toISOString()
  const [cached] = useState(() => cachedToday(session.shopId, day))
  const [payments, setPayments] = useState<PaymentSummary[] | null>(cached?.payments ?? null)
  const [total, setTotal] = useState<Money>(
    cached?.total ?? zeroMoney(session.assetCode, session.assetScale),
  )
  const [access, setAccess] = useState<FeedAccess | null>(null)
  // Bumped to ask for a new ticket (the stream gave up, or the API didn't answer).
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (payments) writeCache(`feed.${session.shopId}`, { day, payments, total })
  }, [session.shopId, day, payments, total])

  useEffect(() => {
    let active = true
    feedAccess(session, since).then(
      (next) => active && setAccess(next),
      () => active && setAccess({ kind: 'unreachable' }),
    )
    return () => {
      active = false
    }
  }, [session, since, round])

  const url = access?.kind === 'open' ? access.url : null
  const stream = useEventSource(url, {
    snapshot: (data) => {
      const snapshot = ShopPaymentsResponseSchema.parse(data)
      setPayments(snapshot.payments)
      setTotal(snapshot.total)
    },
    payment: (data) => {
      const payment = PaymentSummarySchema.parse(data)
      setPayments((list) => upsert(list ?? [], payment))
      onNewPayment?.(payment)
    },
  })

  // The shop's feed must survive API restarts and sleeping hosts: when the stream gives up (its
  // ticket may have expired too) or the API didn't answer, ask again, waiting a little longer
  // each time. A live stream resets the wait.
  const failures = useRef(0)
  useEffect(() => {
    if (stream === 'live') failures.current = 0
  }, [stream])
  const unreachable = access?.kind === 'unreachable'
  const stuck = unreachable || (url !== null && stream === 'closed')
  useEffect(() => {
    if (!stuck) return
    const delay = Math.min(FIRST_RETRY_MS * 2 ** failures.current, MAX_RETRY_MS)
    failures.current += 1
    const timer = setTimeout(() => setRound((n) => n + 1), delay)
    return () => clearTimeout(timer)
  }, [stuck, access])

  // Totals change on completion, which arrives as a 'payment' event: recompute from the list.
  const liveTotal = useMemo(() => {
    if (!payments) return total
    const completed = payments.filter((payment) => payment.status === 'completed')
    const sum = completed.reduce((acc, payment) => acc + BigInt(payment.amount.value), 0n)
    return { ...total, value: sum.toString() }
  }, [payments, total])

  const loaded = payments !== null
  if (access?.kind === 'signed-out')
    return { state: 'unauthorized', loaded, payments: payments ?? [], total: liveTotal }
  const state: StreamState = unreachable ? 'closed' : stream
  return {
    // A stream that gave up says so, even before the first snapshot.
    state: loaded || state === 'closed' ? state : 'loading',
    loaded,
    payments: payments ?? [],
    total: liveTotal,
  }
}
