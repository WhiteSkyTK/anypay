import { type PaymentSummary, PaymentSummarySchema } from '@anypay/shared'
import { useState } from 'react'
import { api } from '@/lib/api'
import { type StreamState, useEventSource } from './useEventSource'

export interface PaymentStatus {
  payment: PaymentSummary | null
  stream: StreamState
}

const isFinal = (payment: PaymentSummary | null) =>
  payment?.status === 'completed' || payment?.status === 'failed'

/** The customer's receipt, updated live until the payment completes or fails. */
export function usePaymentStatus(paymentId: string): PaymentStatus {
  const [payment, setPayment] = useState<PaymentSummary | null>(null)
  // Stop listening once the outcome is known: the server closes the stream too.
  const url = isFinal(payment) ? null : api.paymentEventsUrl(paymentId)
  const stream = useEventSource(url, {
    payment: (data) => setPayment(PaymentSummarySchema.parse(data)),
  })
  return { payment, stream }
}
