import { useSyncExternalStore } from 'react'
import {
  getMerchantSession,
  type MerchantSession,
  subscribeMerchantSession,
} from '@/lib/merchant-session'

/** The shop this phone runs, or null; updates everywhere when it changes. */
export function useMerchantSession(): MerchantSession | null {
  return useSyncExternalStore(subscribeMerchantSession, getMerchantSession, () => null)
}
