// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useHideSplash } from './useHideSplash'

it('removes the start-up mark once the first screen renders', () => {
  const splash = document.createElement('div')
  splash.id = 'splash'
  document.body.append(splash)
  renderHook(() => useHideSplash())
  expect(document.getElementById('splash')).toBeNull()
})
