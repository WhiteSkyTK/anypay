// AnyPay's idea of "now", corrected by the server's clock. Offline sale vouchers carry a time
// stamp the server checks (at most 72 hours old, 10 minutes ahead), and budget phones often have
// the wrong time: after a flat battery, or set by hand. Every API response carries the server's
// Date, so the phone learns how far off it is and corrects its stamps, even later with no signal.

const STORAGE_KEY = 'anypay.clockOffset'
/** Off by more than this, the phone is told to fix its clock (AnyPay still corrects for it). */
export const CLOCK_WARNING_MS = 10 * 60 * 1000

function readOffset(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(stored) ? stored : 0
  } catch {
    return 0
  }
}

let offset: number | undefined

/** Server time minus this phone's time, in ms: 0 until the first API response. */
export function clockOffsetMs(): number {
  offset ??= readOffset()
  return offset
}

/** This phone's time, corrected to the server's. Use it for anything the server will check. */
export const serverNow = (): number => Date.now() + clockOffsetMs()

/**
 * Learns the offset from a response's Date header (whole seconds). The midpoint of the request
 * stands in for when the server stamped it, so network delay doesn't count as clock error.
 */
export function noteServerDate(header: string | null, sentAt: number, receivedAt: number): void {
  const serverTime = header ? Date.parse(header) : Number.NaN
  if (Number.isNaN(serverTime)) return
  const measured = serverTime + 500 - (sentAt + receivedAt) / 2
  // Under two seconds is header rounding and network jitter, not a wrong clock.
  offset = Math.abs(measured) < 2000 ? 0 : Math.round(measured)
  try {
    localStorage.setItem(STORAGE_KEY, String(offset))
  } catch {
    // Not remembered: learned again from the next response.
  }
}
