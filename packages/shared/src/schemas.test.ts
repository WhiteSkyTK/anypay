import { describe, expect, it } from 'vitest'
import {
  ApiErrorSchema,
  HealthResponseSchema,
  IdempotencyKeySchema,
  MinorUnitsSchema,
  MoneySchema,
  WalletAddressInputSchema,
} from './schemas'

const firstMessage = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message

describe('MinorUnitsSchema', () => {
  it.each(['0', '1', '2500', '18446744073709551615'])('accepts %j', (value) => {
    expect(MinorUnitsSchema.safeParse(value).success).toBe(true)
  })

  it.each(['', '-1', '01', '2.5', ' 1', 'abc'])('rejects %j', (value) => {
    const result = MinorUnitsSchema.safeParse(value)
    expect(result.success).toBe(false)
    expect(firstMessage(result)).toBe('errors.money.minorUnits')
  })
})

describe('MoneySchema', () => {
  it('accepts an Open Payments amount', () => {
    const amount = { value: '2500', assetCode: 'ZAR', assetScale: 2 }
    expect(MoneySchema.parse(amount)).toEqual(amount)
  })

  it('rejects floats and fractional scales', () => {
    expect(MoneySchema.safeParse({ value: 25, assetCode: 'ZAR', assetScale: 2 }).success).toBe(
      false,
    )
    expect(MoneySchema.safeParse({ value: '25', assetCode: 'ZAR', assetScale: 1.5 }).success).toBe(
      false,
    )
  })
})

describe('WalletAddressInputSchema', () => {
  it.each(['$ilp.interledger-test.dev/alice', 'https://ilp.interledger-test.dev/alice'])(
    'accepts %j',
    (value) => {
      expect(WalletAddressInputSchema.parse(value)).toBe(value)
    },
  )

  it('trims whitespace from pasted addresses', () => {
    expect(WalletAddressInputSchema.parse('  $wallet.example/shop  ')).toBe('$wallet.example/shop')
  })

  it.each([
    ['', 'errors.walletAddress.required'],
    ['   ', 'errors.walletAddress.required'],
    ['http://wallet.example/shop', 'errors.walletAddress.format'],
    ['wallet.example/shop', 'errors.walletAddress.format'],
    [`$${'a'.repeat(512)}`, 'errors.walletAddress.tooLong'],
  ])('rejects %j with %s', (value, message) => {
    expect(firstMessage(WalletAddressInputSchema.safeParse(value))).toBe(message)
  })
})

describe('IdempotencyKeySchema', () => {
  it('accepts a v4 UUID', () => {
    expect(IdempotencyKeySchema.safeParse('3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c').success).toBe(
      true,
    )
  })

  it('rejects anything else', () => {
    expect(firstMessage(IdempotencyKeySchema.safeParse('retry-1'))).toBe('errors.idempotencyKey')
  })
})

describe('response schemas', () => {
  it('describe the health response', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok', version: '0.1.0' }).success).toBe(true)
    expect(HealthResponseSchema.safeParse({ status: 'down', version: '0.1.0' }).success).toBe(false)
  })

  it('describe the error envelope', () => {
    const body = { error: { code: 'not_found', message: 'Not found' }, correlationId: 'abc' }
    expect(ApiErrorSchema.parse(body)).toEqual(body)
  })
})
