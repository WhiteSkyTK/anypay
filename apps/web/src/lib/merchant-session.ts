import { z } from 'zod'

const STORAGE_KEY = 'anypay.merchant'

/** What this phone needs to run the shop: which shop, and the token proving it's the merchant. */
const MerchantSessionSchema = z.object({
  shopId: z.string(),
  name: z.string(),
  token: z.string(),
  assetCode: z.string(),
  assetScale: z.number().int(),
})

export type MerchantSession = z.infer<typeof MerchantSessionSchema>

const listeners = new Set<() => void>()
let cached: MerchantSession | null | undefined

function read(): MerchantSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? MerchantSessionSchema.safeParse(JSON.parse(raw)) : undefined
    return parsed?.success ? parsed.data : null
  } catch {
    return null
  }
}

export function getMerchantSession(): MerchantSession | null {
  cached ??= read()
  return cached
}

/** Saves (or with null, forgets) the shop on this phone. */
export function setMerchantSession(session: MerchantSession | null): void {
  cached = session
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked (private mode): the session still works until the tab closes.
  }
  listeners.forEach((listener) => listener())
}

export function subscribeMerchantSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
