/**
 * Money in the exact shape Open Payments uses for amounts: an integer count of minor units as a
 * string plus the asset it is in. Never a float, so R0.10 + R0.20 is always exactly R0.30.
 */
export interface Money {
  /** Minor units as a base-10 integer string, e.g. '2500' for R25.00 at assetScale 2. */
  value: string
  /** Asset code, usually ISO 4217, e.g. 'ZAR'. */
  assetCode: string
  /** Decimal places between minor and major units, e.g. 2 for ZAR. */
  assetScale: number
}

export type MoneyErrorCode =
  'invalid_amount' | 'too_many_decimals' | 'invalid_scale' | 'asset_mismatch'

export class MoneyError extends Error {
  readonly code: MoneyErrorCode

  constructor(code: MoneyErrorCode, message: string) {
    super(message)
    this.name = 'MoneyError'
    this.code = code
  }
}

export const DEFAULT_LOCALE = 'en-ZA'
const MAX_ASSET_SCALE = 18
// Accepts '.' or ',' as the separator because en-ZA writes R25,50.
const DECIMAL_INPUT = /^(\d*)(?:[.,](\d*))?$/
const MINOR_UNITS = /^\d+$/
const ISO_CURRENCY = /^[A-Za-z]{3}$/

function assertValidScale(assetScale: number): void {
  if (!Number.isInteger(assetScale) || assetScale < 0 || assetScale > MAX_ASSET_SCALE) {
    throw new MoneyError(
      'invalid_scale',
      `Asset scale must be an integer from 0 to ${MAX_ASSET_SCALE}`,
    )
  }
}

function assertSameAsset(a: Money, b: Money): void {
  if (a.assetCode !== b.assetCode || a.assetScale !== b.assetScale) {
    throw new MoneyError(
      'asset_mismatch',
      `Cannot combine ${a.assetCode} and ${b.assetCode} amounts`,
    )
  }
}

/** Converts what someone typed ('25', '25.5', '25,50') to minor units ('2500' at scale 2). */
export function toMinorUnits(input: string, assetScale: number): string {
  assertValidScale(assetScale)
  const match = DECIMAL_INPUT.exec(input.trim())
  const whole = match?.[1] ?? ''
  const fraction = match?.[2] ?? ''
  if (!match || (whole === '' && fraction === '')) {
    throw new MoneyError('invalid_amount', `Not a valid amount: "${input}"`)
  }
  // Rejecting rather than rounding: silently changing what a customer typed is a payment bug.
  if (fraction.length > assetScale) {
    throw new MoneyError('too_many_decimals', `At most ${assetScale} decimal places allowed`)
  }
  return BigInt(whole + fraction.padEnd(assetScale, '0')).toString()
}

/** Converts minor units to a plain decimal string ('2500' at scale 2 → '25.00'). */
export function fromMinorUnits(value: string, assetScale: number): string {
  assertValidScale(assetScale)
  if (!MINOR_UNITS.test(value)) {
    throw new MoneyError('invalid_amount', `Not a minor-unit integer: "${value}"`)
  }
  const digits = BigInt(value).toString()
  if (assetScale === 0) return digits
  const padded = digits.padStart(assetScale + 1, '0')
  return `${padded.slice(0, -assetScale)}.${padded.slice(-assetScale)}`
}

export function zeroMoney(assetCode: string, assetScale: number): Money {
  assertValidScale(assetScale)
  return { value: '0', assetCode, assetScale }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameAsset(a, b)
  return { ...a, value: (BigInt(a.value) + BigInt(b.value)).toString() }
}

/** Returns -1, 0 or 1, like a sort comparator. */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameAsset(a, b)
  const diff = BigInt(a.value) - BigInt(b.value)
  if (diff === 0n) return 0
  return diff > 0n ? 1 : -1
}

function formatParts(money: Money, locale: string): Intl.NumberFormatPart[] {
  // Intl formats a decimal *string* exactly, so no float ever touches the amount.
  const decimal = fromMinorUnits(money.value, money.assetScale) as `${number}`
  const digits = {
    minimumFractionDigits: money.assetScale,
    maximumFractionDigits: money.assetScale,
  }
  if (ISO_CURRENCY.test(money.assetCode)) {
    const options = { ...digits, style: 'currency', currency: money.assetCode } as const
    return new Intl.NumberFormat(locale, options).formatToParts(decimal)
  }
  // Open Payments allows non-ISO asset codes, which Intl's currency style rejects.
  return [
    ...new Intl.NumberFormat(locale, digits).formatToParts(decimal),
    { type: 'literal', value: ' ' },
    { type: 'currency', value: money.assetCode },
  ]
}

function joinParts(parts: Intl.NumberFormatPart[]): string {
  return parts.map((part) => part.value).join('')
}

/** Formats for display, e.g. 'R 25,00' in en-ZA. */
export function formatMoney(money: Money, locale: string = DEFAULT_LOCALE): string {
  return joinParts(formatParts(money, locale))
}

/**
 * Splits a formatted amount so the UI can render the cents smaller ('R 25' + ',00'),
 * while the order of currency symbol and separators still follows the locale.
 */
export function splitMoneyForDisplay(
  money: Money,
  locale: string = DEFAULT_LOCALE,
): { whole: string; fraction: string } {
  const parts = formatParts(money, locale)
  const decimalIndex = parts.findIndex((part) => part.type === 'decimal')
  if (decimalIndex === -1) return { whole: joinParts(parts), fraction: '' }
  return {
    whole: joinParts(parts.slice(0, decimalIndex)),
    fraction: joinParts(parts.slice(decimalIndex)),
  }
}
