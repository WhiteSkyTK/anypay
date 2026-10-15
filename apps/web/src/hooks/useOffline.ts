import { useEffect, useState } from 'react'
import { loadOffline } from '@/lib/offline-flag'

export type OfflineModule = Awaited<ReturnType<typeof loadOffline>>

/**
 * The offline store, loaded when a screen first needs it (null until then). Also starts the
 * SyncManager, so anything waiting goes out as soon as there is signal.
 */
export function useOffline(): OfflineModule | null {
  const [offline, setOffline] = useState<OfflineModule | null>(null)
  useEffect(() => {
    let active = true
    void loadOffline().then((module) => {
      module.startOfflineSync()
      if (active) setOffline(module)
    })
    return () => {
      active = false
    }
  }, [])
  return offline
}

/**
 * A live view of the offline store: re-runs whenever the data it read changes (Dexie
 * liveQuery), so outbox states move from Saved to Settled on screen by themselves. `key`
 * names the query's inputs: a new key starts a new query.
 */
export function useOfflineQuery<T>(
  offline: OfflineModule | null,
  key: string,
  query: (offline: OfflineModule) => Promise<T>,
): T | undefined {
  const [result, setResult] = useState<{ key: string; value: T }>()
  const queryRef = useLatest(query)
  useEffect(() => {
    if (!offline) return
    const subscription = offline
      .liveQuery(() => queryRef.current(offline))
      .subscribe({
        next: (value) => setResult({ key, value }),
        error: () => undefined,
      })
    return () => subscription.unsubscribe()
  }, [offline, key, queryRef])
  return result?.key === key ? result.value : undefined
}

function useLatest<T>(value: T): { current: T } {
  const [ref] = useState(() => ({ current: value }))
  useEffect(() => {
    ref.current = value
  })
  return ref
}
