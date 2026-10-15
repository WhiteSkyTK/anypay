import type { z } from 'zod'

const PREFIX = 'anypay.cache.'

/**
 * Small things worth keeping on the phone between visits (a shop's profile, today's feed), so a
 * screen can show them at once and still has them when the signal drops. Storage is untrusted, so
 * reads are checked against the schema; anything unreadable counts as "not cached".
 */
export function readCache<S extends z.ZodType>(key: string, schema: S): z.infer<S> | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return undefined
    const parsed = schema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

/** Best effort: private mode or a full disk just means the next visit fetches again. */
export function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Not cached; nothing else depends on it.
  }
}
