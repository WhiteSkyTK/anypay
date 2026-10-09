import { describe, expect, it } from 'vitest'
import { applyKey, isPayable, type KeypadKey, MAX_WHOLE_DIGITS, normaliseTyped } from './keypad'

const press = (keys: readonly KeypadKey[], decimals = 2) =>
  keys.reduce((value, key) => applyKey(value, key, decimals), '')

describe('applyKey', () => {
  it('builds an amount digit by digit', () => {
    expect(press(['2', '5', ',', '5', '0'])).toBe('25,50')
  })

  it('replaces a lone leading zero instead of stacking zeros', () => {
    expect(press(['0', '0', '7'])).toBe('7')
  })

  it('starts a fraction with 0 when the comma comes first', () => {
    expect(press([','])).toBe('0,')
  })

  it('allows one comma and at most `decimals` places', () => {
    expect(press(['1', ',', '2', ',', '3', '4'])).toBe('1,23')
  })

  it('ignores the comma for currencies without cents', () => {
    expect(press(['5', ',', '0'], 0)).toBe('50')
  })

  it('caps the whole part so the amount fits on one line', () => {
    const keys = Array.from<KeypadKey>({ length: MAX_WHOLE_DIGITS + 3 }).fill('9')
    expect(press(keys)).toHaveLength(MAX_WHOLE_DIGITS)
  })

  it('deletes the last character', () => {
    expect(press(['1', ',', '5', 'back'])).toBe('1,')
    expect(applyKey('', 'back', 2)).toBe('')
  })
})

describe('normaliseTyped', () => {
  it('accepts a dot as the decimal separator', () => {
    expect(normaliseTyped('12.5', 2)).toBe('12,5')
  })

  it('drops anything that is not a digit or separator', () => {
    expect(normaliseTyped('R 1 234,567', 2)).toBe('1234,56')
  })
})

describe('isPayable', () => {
  it.each(['1', '0,01', '10'])('accepts %s', (value) => {
    expect(isPayable(value)).toBe(true)
  })

  it.each(['', '0', '0,', '0,00'])('rejects %s', (value) => {
    expect(isPayable(value)).toBe(false)
  })
})
