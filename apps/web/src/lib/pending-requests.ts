// Which API requests are still waiting, so the app can say "still working" instead of looking
// frozen: a sleeping free server takes up to a minute to wake, and a weak signal can stall.

/** How long a request may take before the app says it is still working on it. */
export const SLOW_AFTER_MS = 4000

/** Start time of each request still waiting, by request number. */
const pending = new Map<number, number>()
const listeners = new Set<() => void>()
let slow = false
let nextId = 0

function update(): void {
  const now = Date.now()
  const next = [...pending.values()].some((startedAt) => now - startedAt >= SLOW_AFTER_MS)
  if (next === slow) return
  slow = next
  listeners.forEach((listener) => listener())
}

/** Marks a request as started; call the returned function when it has finished. */
export function trackRequest(now = Date.now()): () => void {
  const key = nextId++
  pending.set(key, now)
  const timer = setTimeout(update, SLOW_AFTER_MS)
  return () => {
    clearTimeout(timer)
    pending.delete(key)
    update()
  }
}

/** True while any request has been waiting longer than SLOW_AFTER_MS. */
export const isSlow = (): boolean => slow

export function subscribeSlow(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
