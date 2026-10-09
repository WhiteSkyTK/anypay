import { setTimeout as sleep } from 'node:timers/promises'
import type { Logger } from './logger'

interface CheckOptions {
  attempts?: number
  delayMs?: number
  fetchFn?: typeof fetch
}

/**
 * Wallets send customers back to PUBLIC_API_URL after they approve a payment, so a typo there
 * (a missing ".com") breaks every payment with no error anywhere. This asks that address for
 * /health a few times after startup (a host may route traffic only once the new instance is up)
 * and warns loudly if it never answers.
 */
export async function checkPublicUrl(
  publicApiUrl: string,
  logger: Logger,
  { attempts = 3, delayMs = 20_000, fetchFn = fetch }: CheckOptions = {},
): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchFn(`${publicApiUrl}/health`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (response.ok) {
        logger.info({ publicApiUrl }, 'PUBLIC_API_URL reaches the API')
        return true
      }
    } catch {
      // Not reachable (yet): try again after the delay.
    }
    if (attempt < attempts) await sleep(delayMs)
  }
  logger.warn(
    { publicApiUrl },
    'PUBLIC_API_URL does not reach the API: wallets cannot send customers back after they approve. Check it for typos.',
  )
  return false
}
