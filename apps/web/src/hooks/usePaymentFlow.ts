import type { CreatePaymentResponse, Shop } from '@anypay/shared'
import { useCallback, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { errorMessageKey, failureMessageKey } from '@/lib/error-message'
import { uuid } from '@/lib/uuid'

const WALLET_KEY = 'anypay.customerWallet'

export type PaymentFlowState =
  | { kind: 'editing' }
  | { kind: 'quoting' }
  | { kind: 'quoted'; response: CreatePaymentResponse & { consentUrl: string } }
  | { kind: 'redirecting'; response: CreatePaymentResponse & { consentUrl: string } }
  | { kind: 'error'; messageKey: string }

function readWallet(): string {
  try {
    return localStorage.getItem(WALLET_KEY) ?? ''
  } catch {
    return ''
  }
}

function rememberWallet(wallet: string): void {
  try {
    localStorage.setItem(WALLET_KEY, wallet)
  } catch {
    // Not remembered: the customer types it again next time.
  }
}

/**
 * The customer's side of Feature 2: amount → quote (exact debit, fees and FX included) → off to
 * their own wallet to approve. One Idempotency-Key per attempt: retrying after a dropped
 * connection reuses it, so a payment is never created twice.
 */
export function usePaymentFlow(shop: Shop) {
  const [state, setState] = useState<PaymentFlowState>({ kind: 'editing' })
  const [wallet, setWallet] = useState(readWallet)
  const attemptKey = useRef<string | null>(null)

  const requestQuote = useCallback(
    async (amount: string) => {
      attemptKey.current ??= uuid()
      setState({ kind: 'quoting' })
      try {
        const response = await api.startPayment(
          shop.id,
          { amount, customerWallet: wallet.trim() },
          attemptKey.current,
        )
        rememberWallet(wallet.trim())
        attemptKey.current = null
        const { payment, consentUrl } = response
        if (payment.failure)
          setState({ kind: 'error', messageKey: failureMessageKey(payment.failure) })
        else if (consentUrl) setState({ kind: 'quoted', response: { ...response, consentUrl } })
        else setState({ kind: 'error', messageKey: 'errors.api.unknown' })
      } catch (error) {
        // Keep the key: a retry of this same attempt must not create a second payment.
        setState({ kind: 'error', messageKey: errorMessageKey(error) })
      }
    },
    [shop.id, wallet],
  )

  /** Leaves for the customer's wallet; they come back to the receipt page. */
  const approve = useCallback(() => {
    if (state.kind !== 'quoted') return
    setState({ kind: 'redirecting', response: state.response })
    window.location.assign(state.response.consentUrl)
  }, [state])

  const edit = useCallback(() => {
    attemptKey.current = null
    setState({ kind: 'editing' })
  }, [])

  return { state, wallet, setWallet, requestQuote, approve, edit }
}
