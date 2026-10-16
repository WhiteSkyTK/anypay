import { useEffect, useSyncExternalStore } from 'react'
import { switchPreference } from '@/lib/switch-preference'

const preference = switchPreference('anypay.keepAwake')

const isSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator

/**
 * "Keep the screen on" for the shop's feed. A phone propped on the counter otherwise dims and
 * locks, and a locked browser stops the live feed and the spoken "Payment received". Uses the
 * Screen Wake Lock API, which the browser drops whenever the app is in the background, so it is
 * taken again on every return. Off by default (it costs battery).
 */
export function useKeepAwake() {
  const enabled = useSyncExternalStore(preference.subscribe, preference.read, () => false)
  const supported = isSupported()

  useEffect(() => {
    if (!enabled || !supported) return
    let lock: WakeLockSentinel | undefined
    let stopped = false
    const acquire = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then(
        (sentinel) => {
          if (stopped) sentinel.release().catch(() => undefined)
          else lock = sentinel
        },
        () => undefined, // refused (battery saver): the screen just behaves as usual
      )
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', acquire)
      lock?.release().catch(() => undefined)
    }
  }, [enabled, supported])

  return { enabled, supported, setEnabled: preference.write }
}
