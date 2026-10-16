// @vitest-environment happy-dom
// How the app copes with what goes wrong on real phones and networks: slow or sleeping servers,
// stalled connections, wrong clocks, a deploy mid-visit, storage that is full or blocked.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiRequestError } from './api'
import { errorMessageKey } from './error-message'
import { offlineProblem, offlineProblemOf } from './offline-support'
import { isSlow, SLOW_AFTER_MS, subscribeSlow, trackRequest } from './pending-requests'
import { CLOCK_WARNING_MS, clockOffsetMs, noteServerDate, serverNow } from './server-clock'
import { reloadOnStaleBuild } from './stale-build'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

describe('slow requests', () => {
  it('says "still working" only once a request has waited a few seconds', () => {
    vi.useFakeTimers()
    const changed = vi.fn()
    const unsubscribe = subscribeSlow(changed)
    const done = trackRequest()
    vi.advanceTimersByTime(SLOW_AFTER_MS - 1)
    expect(isSlow()).toBe(false)
    vi.advanceTimersByTime(1)
    expect(isSlow()).toBe(true)
    done()
    expect(isSlow()).toBe(false)
    expect(changed).toHaveBeenCalledTimes(2)
    unsubscribe()
  })
})

describe('API answers that are not answers', () => {
  it('reports a stalled connection as a timeout, which has its own message', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.reject(new DOMException('signal timed out', 'TimeoutError')),
    )
    const error = await api.config().catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'timeout' })
    expect(errorMessageKey(error)).toBe('errors.api.timeout')
  })

  it('tells a sleeping or restarting host (its own 502 page) from a real error', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('<html>Bad gateway</html>', { status: 502 })),
    )
    const error = await api.config().catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(errorMessageKey(error)).toBe('errors.api.unavailable')
  })
})

describe('a phone with the wrong clock', () => {
  afterEach(() => noteServerDate(new Date().toUTCString(), Date.now(), Date.now()))

  it('learns the offset from the server’s Date header and corrects "now"', () => {
    const now = Date.now()
    noteServerDate(new Date(now - 3 * 3_600_000).toUTCString(), now, now)
    expect(clockOffsetMs()).toBeLessThan(-3 * 3_600_000 + 2000)
    expect(Math.abs(serverNow() - (now - 3 * 3_600_000))).toBeLessThan(2000)
    expect(Math.abs(clockOffsetMs())).toBeGreaterThan(CLOCK_WARNING_MS)
  })

  it('ignores header rounding and network delay', () => {
    const now = Date.now()
    noteServerDate(new Date(now).toUTCString(), now - 300, now + 300)
    expect(clockOffsetMs()).toBe(0)
  })

  it('keeps the last offset when a response has no usable date', () => {
    const now = Date.now()
    noteServerDate(new Date(now + 3_600_000).toUTCString(), now, now)
    noteServerDate(null, now, now)
    noteServerDate('not a date', now, now)
    expect(clockOffsetMs()).toBeGreaterThan(3_600_000 - 2000)
  })
})

describe('a deploy while the app is open', () => {
  function fakeWindow() {
    const target = new EventTarget() as EventTarget & {
      sessionStorage: Storage
      location: { reload: () => void }
    }
    target.sessionStorage = sessionStorage
    target.location = { reload: vi.fn() }
    return target
  }

  const staleChunk = () => new Event('vite:preloadError', { cancelable: true })

  it('reloads once to get the new build, instead of showing an error', () => {
    const target = fakeWindow()
    reloadOnStaleBuild(target as unknown as Window)
    const event = staleChunk()
    target.dispatchEvent(event)
    expect(target.location.reload).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('never reloads in a loop: a second failure right after shows the error screen', () => {
    const target = fakeWindow()
    reloadOnStaleBuild(target as unknown as Window)
    target.dispatchEvent(staleChunk())
    const again = staleChunk()
    target.dispatchEvent(again)
    expect(target.location.reload).toHaveBeenCalledTimes(1)
    expect(again.defaultPrevented).toBe(false)
  })
})

describe('storage for offline tabs', () => {
  it('needs a secure context for signing vouchers', () => {
    vi.stubGlobal('isSecureContext', false)
    expect(offlineProblem()).toBe('insecure')
  })

  it('tells a full phone from storage that is blocked', () => {
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('indexedDB', {})
    expect(offlineProblemOf(new DOMException('full', 'QuotaExceededError'))).toBe('full')
    expect(offlineProblemOf(new Error('OpenFailedError'))).toBe('storage')
  })
})
