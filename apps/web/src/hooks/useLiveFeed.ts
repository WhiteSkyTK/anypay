import {
  type Money,
  type PaymentSummary,
  PaymentSummarySchema,
  ShopPaymentsResponseSchema,
  zeroMoney,
} from '@anypay/shared'
import { useEffect, useMemo, useState } from 'react'
import { api, ApiRequestError } from '@/lib/api'
import { startOfToday } from '@/lib/format'
import type { MerchantSession } from '@/lib/merchant-session'
import { type StreamState, useEventSource } from './useEventSource'

export type FeedState = StreamState | 'loading' | 'unauthorized'

export interface LiveFeed {
  state: FeedState
  /** False until the first snapshot: show skeletons, not "no payments". */
  loaded: boolean
  payments: PaymentSummary[]
  total: Money
}

function upsert(list: PaymentSummary[], payment: PaymentSummary): PaymentSummary[] {
  const rest = list.filter((existing) => existing.id !== payment.id)
  return [payment, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Today's payments for the shop on this phone, pushed live over SSE (the phone never polls).
 * After any reconnect the server sends a fresh snapshot, so nothing is missed while offline.
 */
export function useLiveFeed(
  session: MerchantSession,
  onNewPayment?: (payment: PaymentSummary) => void,
): LiveFeed {
  const since = useMemo(() => startOfToday(), [])
  const [payments, setPayments] = useState<PaymentSummary[] | null>(null)
  const [total, setTotal] = useState<Money>(zeroMoney(session.assetCode, session.assetScale))
  const [unauthorized, setUnauthorized] = useState(false)

  const url = unauthorized ? null : api.shopEventsUrl(session.shopId, session.token, since)
  // The shop's feed must survive API restarts and sleeping hosts, so it keeps trying.
  const stream = useEventSource(
    url,
    {
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
    },
    { reconnectWhenClosed: true },
  )

  // EventSource hides HTTP statuses; when it gives up, ask once whether the token was refused
  // or the shop no longer exists (e.g. a reset local database). Anything else: keep retrying.
  useEffect(() => {
    if (stream !== 'closed') return
    api.shopPayments(session.shopId, session.token, since).catch((error: unknown) => {
      if (error instanceof ApiRequestError && [401, 404].includes(error.status))
        setUnauthorized(true)
    })
  }, [stream, session.shopId, session.token, since])

  // Totals change on completion, which arrives as a 'payment' event: recompute from the list.
  const liveTotal = useMemo(() => {
    if (!payments) return total
    const completed = payments.filter((payment) => payment.status === 'completed')
    const sum = completed.reduce((acc, payment) => acc + BigInt(payment.amount.value), 0n)
    return { ...total, value: sum.toString() }
  }, [payments, total])

  const loaded = payments !== null
  if (unauthorized)
    return { state: 'unauthorized', loaded, payments: payments ?? [], total: liveTotal }
  return {
    // A stream that gave up says so, even before the first snapshot.
    state: loaded || stream === 'closed' ? stream : 'loading',
    loaded,
    payments: payments ?? [],
    total: liveTotal,
  }
}
