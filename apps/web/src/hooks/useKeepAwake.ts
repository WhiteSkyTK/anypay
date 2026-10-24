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
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (stopped) await sentinel.release()
        else lock = sentinel
      } catch {
        // Refused (battery saver): the screen just behaves as usual.
      }
    }
    const onVisibility = () => void acquire()
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisibility)
      lock?.release().catch(() => undefined)
    }
  }, [enabled, supported])

  return { enabled, supported, setEnabled: preference.write }
}
