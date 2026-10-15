import { type PaymentSummary, PaymentSummarySchema } from '@anypay/shared'
import { useEffect, useState } from 'react'
import { api, ApiRequestError } from '@/lib/api'
import { type StreamState, useEventSource } from './useEventSource'

export interface PaymentStatus {
  payment: PaymentSummary | null
  stream: StreamState
  /** The API said there is no such payment (not merely that it couldn't be reached). */
  notFound: boolean
}

const isFinal = (payment: PaymentSummary | null) =>
  payment?.status === 'completed' || payment?.status === 'failed'

/**
 * The customer's receipt, updated live until the payment completes or fails. A stream that gives
 * up can mean "no such payment" or "AnyPay is unreachable" (asleep, restarting): one plain request
 * tells them apart, and an unreachable server is retried in the background.
 */
export function usePaymentStatus(paymentId: string): PaymentStatus {
  const [payment, setPayment] = useState<PaymentSummary | null>(null)
  const [notFound, setNotFound] = useState(false)
  // Stop listening once the outcome is known (the server closes the stream too) or it never will be.
  const url = isFinal(payment) || notFound ? null : api.paymentEventsUrl(paymentId)
  const stream = useEventSource(
    url,
    { payment: (data) => setPayment(PaymentSummarySchema.parse(data)) },
    { reconnectWhenClosed: true },
  )

  useEffect(() => {
    if (stream !== 'closed' || payment) return
    api.getPayment(paymentId).then(setPayment, (error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 404) setNotFound(true)
    })
  }, [stream, payment, paymentId])

  return { payment, stream, notFound }
}
