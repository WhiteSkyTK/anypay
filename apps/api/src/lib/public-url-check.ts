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

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Testing on phones over Wi-Fi: the web app is opened at the PC's address (WEB_ORIGIN), but if
 * PUBLIC_API_URL still says localhost, the wallet sends the phone back to the *phone's* own
 * localhost after approval. Returns the fix to log, or null when the pair is consistent.
 */
export function strandedPhonesWarning(webOrigin: string, publicApiUrl: string): string | null {
  const web = new URL(webOrigin)
  const api = new URL(publicApiUrl)
  if (!LOOPBACK.has(api.hostname) || LOOPBACK.has(web.hostname)) return null
  return `PUBLIC_API_URL is ${api.origin} but phones open the app at ${web.origin}: after approving in their wallet they would be sent to their own localhost. Set PUBLIC_API_URL=${web.origin} (the web app forwards /api).`
}
