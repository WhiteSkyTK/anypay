import { useSyncExternalStore } from 'react'
import { isSimulatedOffline, subscribeSimulatedOffline } from '@/lib/simulated-offline'

function subscribe(listener: () => void): () => void {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  const unsubscribeSimulated = subscribeSimulatedOffline(listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
    unsubscribeSimulated()
  }
}

/** Online unless the browser says otherwise or demo mode's "Simulate offline" is on. */
export const isOnline = () => navigator.onLine && !isSimulatedOffline()

/**
 * The browser's own online flag. It can say "online" on a captive or dead connection, so it is
 * a hint for the UI, not proof; the sync layer still treats failed requests as offline.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, isOnline)
}
