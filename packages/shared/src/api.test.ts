import { describe, expect, it } from 'vitest'
import { DecimalAmountSchema, ShopNameSchema } from './api'

const errorOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message

describe('ShopNameSchema', () => {
  it.each(['Kasi Corner Spaza', "Mama T's", 'Spaza ya Lerato 🛒', 'Ézé & Sons'])(
    'accepts %j',
    (name) => {
      expect(ShopNameSchema.safeParse(name).success).toBe(true)
    },
  )

  it('trims, and needs 2 to 60 characters', () => {
    expect(ShopNameSchema.parse('  Kasi  ')).toBe('Kasi')
    expect(errorOf(ShopNameSchema.safeParse('K'))).toBe('errors.shopName.tooShort')
    expect(errorOf(ShopNameSchema.safeParse('K'.repeat(61)))).toBe('errors.shopName.tooLong')
  })

  it.each([
    ['a right-to-left override', 'Kasi \u202ESpaza'],
    ['a zero-width space', 'Kasi\u200BSpaza'],
    ['a control character', 'Kasi\u0007Spaza'],
    ['a line break', 'Kasi\nSpaza'],
  ])('refuses %s, which could disguise the name', (_label, name) => {
    expect(errorOf(ShopNameSchema.safeParse(name))).toBe('errors.shopName.characters')
  })
})

describe('DecimalAmountSchema', () => {
  it.each(['25', '25.5', '25,50', '0.01', '999999999', '000999999999.99'])(
    'accepts %j',
    (amount) => {
      expect(DecimalAmountSchema.safeParse(amount).success).toBe(true)
    },
  )

  it.each(['', '-5', '1e9', '25.', '.5', '2 5', 'R25'])('refuses %j as not an amount', (amount) => {
    expect(errorOf(DecimalAmountSchema.safeParse(amount))).toBe('errors.money.invalid')
  })

  it('refuses absurd amounts', () => {
    expect(errorOf(DecimalAmountSchema.safeParse('1000000000'))).toBe('errors.money.tooLarge')
    expect(errorOf(DecimalAmountSchema.safeParse('9'.repeat(21)))).toBe('errors.money.tooLarge')
  })
})
