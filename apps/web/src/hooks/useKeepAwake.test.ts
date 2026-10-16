// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useKeepAwake } from './useKeepAwake'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

function fakeWakeLock() {
  const release = vi.fn(() => Promise.resolve())
  const request = vi.fn(() => Promise.resolve({ release }))
  vi.stubGlobal('navigator', { wakeLock: { request } })
  return { request, release }
}

it('keeps the screen on while switched on, again after the app was in the background', async () => {
  const lock = fakeWakeLock()
  const { result } = renderHook(() => useKeepAwake())
  expect(result.current.supported).toBe(true)
  expect(lock.request).not.toHaveBeenCalled() // off until the shop turns it on

  act(() => result.current.setEnabled(true))
  await waitFor(() => expect(lock.request).toHaveBeenCalledTimes(1))
  // The browser drops the lock in the background; coming back takes it again.
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  await waitFor(() => expect(lock.request).toHaveBeenCalledTimes(2))

  act(() => result.current.setEnabled(false))
  await waitFor(() => expect(lock.release).toHaveBeenCalled())
})

it('is simply not offered where the browser has no wake lock', () => {
  vi.stubGlobal('navigator', {})
  const { result } = renderHook(() => useKeepAwake())
  expect(result.current.supported).toBe(false)
})
