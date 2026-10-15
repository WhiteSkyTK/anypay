import { type Shop, ShopSchema } from '@anypay/shared'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { readCache, writeCache } from '@/lib/cache'
import { errorMessageKey } from '@/lib/error-message'

export type ShopState =
  | { kind: 'loading' }
  | { kind: 'ready'; shop: Shop }
  | { kind: 'error'; messageKey: string; notFound: boolean }

const cacheKey = (shopId: string) => `shop.${shopId}`

/**
 * The public shop profile behind a QR code. A shop paid before opens at once from the phone's
 * cache (and still opens with no signal), while the profile is checked again in the background.
 * `retry` reloads it, e.g. after coming back online.
 */
export function useShop(shopId: string): { state: ShopState; retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  const request = `${shopId}#${attempt}`
  // Results are tagged with their request, so a new request reads as loading without an extra render.
  const [result, setResult] = useState<{ request: string; state: ShopState } | null>(null)
  const cached = useMemo(() => readCache(cacheKey(shopId), ShopSchema), [shopId])

  useEffect(() => {
    let active = true
    api.getShop(shopId).then(
      (shop) => {
        writeCache(cacheKey(shopId), shop)
        if (active) setResult({ request, state: { kind: 'ready', shop } })
      },
      (error: unknown) => {
        if (!active) return
        const messageKey = errorMessageKey(error)
        const notFound = messageKey === 'errors.api.shop_not_found'
        // No signal: the cached profile is still right. A shop that is gone is not.
        const state: ShopState =
          cached && !notFound
            ? { kind: 'ready', shop: cached }
            : { kind: 'error', messageKey, notFound }
        setResult({ request, state })
      },
    )
    return () => {
      active = false
    }
  }, [shopId, request, cached])

  const fallback: ShopState = cached ? { kind: 'ready', shop: cached } : { kind: 'loading' }
  const state = result?.request === request ? result.state : fallback
  return { state, retry: () => setAttempt((n) => n + 1) }
}
