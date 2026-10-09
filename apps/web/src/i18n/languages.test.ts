import { describe, expect, it } from 'vitest'
import { initialLanguage, isLanguageCode } from './languages'

describe('initialLanguage', () => {
  it('starts in English when nothing was chosen', () => {
    expect(initialLanguage(null)).toBe('en')
  })

  it.each(['nso', 'xh', 'zu', 'en'])('remembers a chosen language: %s', (code) => {
    expect(initialLanguage(code)).toBe(code)
  })

  it.each(['klingon', '', 'zu-ZA', 42])('ignores junk in storage: %s', (stored) => {
    expect(initialLanguage(stored)).toBe('en')
  })
})

describe('isLanguageCode', () => {
  it.each(['en', 'nso', 'xh', 'zu'])('accepts %s', (code) => {
    expect(isLanguageCode(code)).toBe(true)
  })

  it.each(['', 'EN', 'zu-ZA', 'af', null])('rejects %s', (code) => {
    expect(isLanguageCode(code)).toBe(false)
  })
})
