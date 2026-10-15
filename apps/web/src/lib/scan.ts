/** AnyPay links a scan may open: sale requests, vouchers and shop posters. */
const ANYPAY_PATH = /^\/(?:t|v|s|shop)\/[\w/-]+$/

/**
 * Where a scanned code leads inside the app, or null if it isn't an AnyPay code. Only the path is
 * used, never the origin: a poster printed for the live site works in any copy of the app, and a
 * code can never send the phone to another website.
 */
export function anypayPath(scanned: string): string | null {
  try {
    const { pathname } = new URL(scanned.trim(), window.location.origin)
    return ANYPAY_PATH.test(pathname) ? pathname : null
  } catch {
    return null
  }
}
