import { describe, expect, it } from 'vitest'
import { detectLanguage, isLanguageCode } from './languages'

describe('detectLanguage', () => {
  it('keeps a saved choice over the phone language', () => {
    expect(detectLanguage('xh', ['zu-ZA'])).toBe('xh')
  })

  it.each([
    [['zu-ZA', 'en-ZA'], 'zu'],
    [['xh'], 'xh'],
    [['nso-ZA'], 'nso'],
    [['NSO'], 'nso'],
    [['af-ZA', 'xh-ZA'], 'xh'],
  ])('picks the first supported phone language from %j', (preferred, expected) => {
    expect(detectLanguage(null, preferred)).toBe(expected)
  })

  it('falls back to English for unsupported languages', () => {
    expect(detectLanguage(null, ['af-ZA', 'fr'])).toBe('en')
    expect(detectLanguage(null, [])).toBe('en')
  })

  it('ignores junk in storage', () => {
    expect(detectLanguage('klingon', ['zu'])).toBe('zu')
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
