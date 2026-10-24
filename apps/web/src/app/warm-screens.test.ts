import { describe, expect, it, vi } from 'vitest'
import { warmScreens } from './warm-screens'

describe('warmScreens', () => {
  it('fetches a kind of phone’s screens once per visit, and survives a failed download', async () => {
    vi.useFakeTimers()
    const ok = vi.fn(() => Promise.resolve())
    const offline = vi.fn(() => Promise.reject(new Error('No signal')))
    const screens = { shop: [ok, offline], tab: [ok] }

    warmScreens('shop', screens)
    warmScreens('shop', screens) // a second call in the same visit does nothing
    await vi.runAllTimersAsync()

    expect(ok).toHaveBeenCalledTimes(1)
    expect(offline).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
