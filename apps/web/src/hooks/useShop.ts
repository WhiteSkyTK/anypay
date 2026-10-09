import type { Shop } from '@anypay/shared'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { errorMessageKey } from '@/lib/error-message'

export type ShopState =
  | { kind: 'loading' }
  | { kind: 'ready'; shop: Shop }
  | { kind: 'error'; messageKey: string; notFound: boolean }

/** The public shop profile behind a QR code. `retry` reloads it, e.g. after coming back online. */
export function useShop(shopId: string): { state: ShopState; retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  const request = `${shopId}#${attempt}`
  // Results are tagged with their request, so a new request reads as loading without an extra render.
  const [result, setResult] = useState<{ request: string; state: ShopState } | null>(null)

  useEffect(() => {
    let active = true
    api.getShop(shopId).then(
      (shop) => active && setResult({ request, state: { kind: 'ready', shop } }),
      (error: unknown) => {
        if (!active) return
        const messageKey = errorMessageKey(error)
        const notFound = messageKey === 'errors.api.shop_not_found'
        setResult({ request, state: { kind: 'error', messageKey, notFound } })
      },
    )
    return () => {
      active = false
    }
  }, [shopId, request])

  const state: ShopState = result?.request === request ? result.state : { kind: 'loading' }
  return { state, retry: () => setAttempt((n) => n + 1) }
}
