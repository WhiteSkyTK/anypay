import { describe, expect, it } from 'vitest'
import {
  addMoney,
  compareMoney,
  formatMoney,
  fromMinorUnits,
  MoneyError,
  splitMoneyForDisplay,
  toMinorUnits,
  zeroMoney,
  type Money,
} from './money'

const zar = (value: string): Money => ({ value, assetCode: 'ZAR', assetScale: 2 })
// Intl uses (narrow) non-breaking spaces; \s matches them, so tests compare plain spaces.
const plain = (text: string) => text.replace(/\s/g, ' ')

function moneyErrorCode(run: () => unknown): string | undefined {
  try {
    run()
  } catch (error) {
    if (error instanceof MoneyError) return error.code
    throw error
  }
  return undefined
}

describe('toMinorUnits', () => {
  it.each([
    ['25', 2, '2500'],
    ['25.5', 2, '2550'],
    ['25.50', 2, '2550'],
    ['25,50', 2, '2550'],
    ['0.05', 2, '5'],
    ['.5', 2, '50'],
    ['25.', 2, '2500'],
    ['007.10', 2, '710'],
    ['  12.34 ', 2, '1234'],
    ['0', 2, '0'],
    ['42', 0, '42'],
    ['1.234567', 6, '1234567'],
    ['92233720368547758.07', 2, '9223372036854775807'],
  ])('converts %j at scale %i to %j', (input, scale, expected) => {
    expect(toMinorUnits(input, scale)).toBe(expected)
  })

  it.each(['', '.', 'abc', '-5', '1e3', '1.2.3', '12 34', 'R25'])('rejects %j', (input) => {
    expect(moneyErrorCode(() => toMinorUnits(input, 2))).toBe('invalid_amount')
  })

  it('rejects more decimals than the asset allows instead of rounding', () => {
    expect(moneyErrorCode(() => toMinorUnits('25.005', 2))).toBe('too_many_decimals')
    expect(moneyErrorCode(() => toMinorUnits('1.5', 0))).toBe('too_many_decimals')
  })

  it.each([-1, 1.5, 19, Number.NaN])('rejects asset scale %s', (scale) => {
    expect(moneyErrorCode(() => toMinorUnits('1', scale))).toBe('invalid_scale')
  })
})

describe('fromMinorUnits', () => {
  it.each([
    ['2500', 2, '25.00'],
    ['5', 2, '0.05'],
    ['0', 2, '0.00'],
    ['0025', 2, '0.25'],
    ['42', 0, '42'],
    ['1234567', 6, '1.234567'],
  ])('converts %j at scale %i to %j', (value, scale, expected) => {
    expect(fromMinorUnits(value, scale)).toBe(expected)
  })

  it('round-trips with toMinorUnits', () => {
    expect(toMinorUnits(fromMinorUnits('123456', 2), 2)).toBe('123456')
  })

  it.each(['', '-5', '2.5', 'abc'])('rejects %j', (value) => {
    expect(moneyErrorCode(() => fromMinorUnits(value, 2))).toBe('invalid_amount')
  })
})

describe('arithmetic', () => {
  it('adds without float drift', () => {
    expect(addMoney(zar('10'), zar('20'))).toEqual(zar('30'))
  })

  it('adds beyond Number.MAX_SAFE_INTEGER exactly', () => {
    expect(addMoney(zar('9007199254740993'), zar('1')).value).toBe('9007199254740994')
  })

  it('compares amounts', () => {
    expect(compareMoney(zar('100'), zar('99'))).toBe(1)
    expect(compareMoney(zar('99'), zar('100'))).toBe(-1)
    expect(compareMoney(zar('100'), zar('100'))).toBe(0)
  })

  it('refuses to mix assets', () => {
    const usd: Money = { value: '1', assetCode: 'USD', assetScale: 2 }
    const zarScale3: Money = { value: '1', assetCode: 'ZAR', assetScale: 3 }
    expect(moneyErrorCode(() => addMoney(zar('1'), usd))).toBe('asset_mismatch')
    expect(moneyErrorCode(() => compareMoney(zar('1'), zarScale3))).toBe('asset_mismatch')
  })

  it('creates zero amounts', () => {
    expect(zeroMoney('ZAR', 2)).toEqual(zar('0'))
  })
})

describe('formatMoney', () => {
  it('formats rand the South African way by default', () => {
    expect(plain(formatMoney(zar('2500')))).toBe('R 25,00')
    expect(plain(formatMoney(zar('123456789')))).toBe('R 1 234 567,89')
  })

  it('follows the requested locale', () => {
    expect(formatMoney({ value: '2500', assetCode: 'USD', assetScale: 2 }, 'en-US')).toBe('$25.00')
  })

  it('shows every decimal the asset has', () => {
    expect(formatMoney({ value: '1', assetCode: 'USD', assetScale: 6 }, 'en-US')).toBe('$0.000001')
  })

  it('falls back gracefully for non-ISO asset codes', () => {
    expect(formatMoney({ value: '150', assetCode: 'TEST1', assetScale: 2 }, 'en-US')).toBe(
      '1.50 TEST1',
    )
  })
})

describe('splitMoneyForDisplay', () => {
  it('splits off the cents so they can be rendered smaller', () => {
    const { whole, fraction } = splitMoneyForDisplay(zar('2550'))
    expect(plain(whole)).toBe('R 25')
    expect(fraction).toBe(',50')
  })

  it('keeps a trailing currency symbol with the fraction', () => {
    const euro: Money = { value: '2550', assetCode: 'EUR', assetScale: 2 }
    const { whole, fraction } = splitMoneyForDisplay(euro, 'de-DE')
    expect(whole).toBe('25')
    expect(plain(fraction)).toBe(',50 €')
  })

  it('returns no fraction for zero-decimal assets', () => {
    const yen: Money = { value: '500', assetCode: 'JPY', assetScale: 0 }
    expect(splitMoneyForDisplay(yen, 'en-US')).toEqual({ whole: '¥500', fraction: '' })
  })
})
