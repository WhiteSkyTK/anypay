import { useEffect, useState } from 'react'
import { loadOffline } from '@/lib/offline-flag'
import { OfflineStoreError, offlineProblem, offlineProblemOf } from '@/lib/offline-support'

export type OfflineModule = Awaited<ReturnType<typeof loadOffline>>

interface OfflineOptions {
  /**
   * For screens where tabs are an extra (the shop's feed): a failure hides that part instead of
   * replacing the screen with the error page.
   */
  quiet?: boolean
}

/**
 * The offline store, loaded when a screen first needs it (null until then). Also starts the
 * SyncManager, so anything waiting goes out as soon as there is signal. If its code can't load
 * (an old build after a deploy, never cached), the screen shows the error page, not a blank one.
 */
export function useOffline({ quiet = false }: OfflineOptions = {}): OfflineModule | null {
  const problem = offlineProblem()
  const [offline, setOffline] = useState<OfflineModule | null>(null)
  const [failure, setFailure] = useState<{ error: unknown }>()
  useEffect(() => {
    let active = true
    loadOffline().then(
      (module) => {
        module.startOfflineSync()
        if (active) setOffline(module)
      },
      (error: unknown) => active && setFailure({ error }),
    )
    return () => {
      active = false
    }
  }, [])
  // Explained by the error screen: e.g. tabs opened on a plain http:// address can't sign.
  if (problem && !quiet) throw new OfflineStoreError(problem)
  if (failure && !quiet) throw failure.error
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
  { quiet = false }: OfflineOptions = {},
): T | undefined {
  const [result, setResult] = useState<{ key: string; value: T }>()
  // Storage that can't be read (blocked, full, closed by the browser) is an error to show,
  // not a screen that waits forever.
  const [failure, setFailure] = useState<{ key: string; error: unknown }>()
  const queryRef = useLatest(query)
  useEffect(() => {
    if (!offline) return
    const subscription = offline
      .liveQuery(() => queryRef.current(offline))
      .subscribe({
        next: (value) => setResult({ key, value }),
        error: (error: unknown) => setFailure({ key, error }),
      })
    return () => subscription.unsubscribe()
  }, [offline, key, queryRef])
  if (failure?.key === key && !quiet) throw new OfflineStoreError(offlineProblemOf(failure.error))
  return result?.key === key ? result.value : undefined
}

function useLatest<T>(value: T): { current: T } {
  const [ref] = useState(() => ({ current: value }))
  useEffect(() => {
    ref.current = value
  })
  return ref
}
