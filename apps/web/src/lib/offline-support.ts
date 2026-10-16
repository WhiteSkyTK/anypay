// Offline tabs need two things a browser may not give: WebCrypto (signing vouchers, only on https
// or localhost, so not on a plain http:// address such as a laptop's IP on the shop's Wi-Fi) and
// IndexedDB (off in some private modes, or when site storage is blocked). Say which is missing,
// instead of a screen that never loads or a voucher that silently isn't saved.

export type OfflineProblem = 'insecure' | 'storage' | 'full'

/** What stops offline tabs working in this browser, before anything is tried. */
export function offlineProblem(): OfflineProblem | null {
  if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) return 'insecure'
  if (!('indexedDB' in globalThis)) return 'storage'
  return null
}

/** What a failure from the offline store (Dexie, IndexedDB, WebCrypto) means for the user. */
export function offlineProblemOf(error: unknown): OfflineProblem {
  const name = (error as { name?: unknown } | null)?.name
  // Dexie keeps the browser's QuotaExceededError name, also when it wraps it.
  if (typeof name === 'string' && name.includes('Quota')) return 'full'
  return offlineProblem() ?? 'storage'
}

/** The offline store failed in a way the user can act on; the error screen explains it. */
export class OfflineStoreError extends Error {
  readonly problem: OfflineProblem

  constructor(problem: OfflineProblem) {
    super(`Offline store unavailable: ${problem}`)
    this.name = 'OfflineStoreError'
    this.problem = problem
  }
}

export const offlineProblemKey = (problem: OfflineProblem) => `errors.offline.${problem}` as const

/**
 * Asks the browser not to clear AnyPay's offline data under storage pressure. Vouchers waiting to
 * settle are money, and device keys can't be recreated. Granted quietly for installed apps and
 * often-used sites; harmless where unsupported.
 */
export async function keepOfflineData(): Promise<void> {
  try {
    if (await navigator.storage?.persisted?.()) return
    await navigator.storage?.persist?.()
  } catch {
    // Not granted: data is still kept, just not guaranteed under pressure.
  }
}
