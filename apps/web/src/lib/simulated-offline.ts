const STORAGE_KEY = 'anypay.simulateOffline'
const listeners = new Set<() => void>()

/**
 * Demo mode's "Simulate offline": the app behaves exactly as with no signal (no API calls, no
 * live feed, vouchers wait in the outbox) without anyone switching on airplane mode on stage.
 */
export function isSimulatedOffline(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function setSimulatedOffline(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, 'on')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked: the switch can't be remembered, so it stays off.
  }
  listeners.forEach((listener) => listener())
  // Coming "back online" should feel like the real thing: syncing starts at once.
  if (!on) window.dispatchEvent(new Event('online'))
}

export function subscribeSimulatedOffline(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
