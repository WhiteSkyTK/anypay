import type { ConfigResponse } from '@anypay/shared'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

let cached: Promise<ConfigResponse | null> | undefined

/** Server settings the UI depends on (the demo banner); fetched once per page load. */
export function useApiConfig(): ConfigResponse | null {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  useEffect(() => {
    let active = true
    // Offline or API down: no banner, nothing else depends on it.
    cached ??= api.config().catch(() => null)
    void cached.then((value) => {
      if (active) setConfig(value)
    })
    return () => {
      active = false
    }
  }, [])
  return config
}
