import { describe, expect, it } from 'vitest'
import { isThemeMode, resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('follows the OS while set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('lets a manual choice override the OS', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('isThemeMode', () => {
  it.each(['system', 'light', 'dark'])('accepts %s', (value) => {
    expect(isThemeMode(value)).toBe(true)
  })

  it.each([null, '', 'DARK', 'sepia', 1])('rejects %s from storage', (value) => {
    expect(isThemeMode(value)).toBe(false)
  })
})
