import type { Shop } from '@anypay/shared'
import { api } from '@/lib/api'

// Started by the pay route's loader, which runs while the page's code is still downloading: a
// customer's first scan asks for the shop at once instead of after the page has arrived. Kept out
// of useShop so the router (in the first chunk) only pulls in the API client.
const prefetched = new Map<string, Promise<Shop>>()

/** Starts loading a shop's profile ahead of its page; the page's first request picks it up. */
export function prefetchShop(shopId: string): void {
  const shop = api.getShop(shopId)
  shop.catch(() => {}) // useShop handles the failure; this keeps an unclaimed one quiet
  prefetched.set(shopId, shop)
}

/** The prefetched request for this shop, once: later requests (a retry) ask afresh. */
export function takePrefetchedShop(shopId: string): Promise<Shop> | undefined {
  const shop = prefetched.get(shopId)
  prefetched.delete(shopId)
  return shop
}
