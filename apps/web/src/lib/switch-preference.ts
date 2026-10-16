/**
 * An on/off setting remembered on this phone (voice confirm, keep the screen on). Off unless
 * turned on; private mode or blocked storage just means it isn't remembered.
 */
export function switchPreference(storageKey: string) {
  const listeners = new Set<() => void>()
  return {
    read(): boolean {
      try {
        return localStorage.getItem(storageKey) === 'on'
      } catch {
        return false
      }
    },
    write(enabled: boolean): void {
      try {
        localStorage.setItem(storageKey, enabled ? 'on' : 'off')
      } catch {
        // Not remembered; still applies for this visit.
      }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
