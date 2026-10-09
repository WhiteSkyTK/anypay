export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'back'

/** Long enough for any real spaza sale, short enough to stay on one line on a small phone. */
export const MAX_WHOLE_DIGITS = 7

/**
 * Applies one keypad press to the typed amount, keeping it valid at every step: one decimal comma,
 * at most `decimals` places, no leading zeros, a sane length. The result is what the API accepts.
 */
export function applyKey(value: string, key: KeypadKey, decimals: number): string {
  if (key === 'back') return value.slice(0, -1)
  const [whole = '', fraction] = value.split(',')
  if (key === ',') {
    if (decimals === 0 || fraction !== undefined) return value
    return `${whole || '0'},`
  }
  if (fraction !== undefined) return fraction.length < decimals ? value + key : value
  if (whole === '0') return key // replace a lone leading zero
  return whole.length < MAX_WHOLE_DIGITS ? value + key : value
}

/** Turns free typing (keyboard, paste) into the same shape the keypad produces. */
export function normaliseTyped(input: string, decimals: number): string {
  const keys = [...input.replaceAll('.', ',')].filter((ch): ch is KeypadKey => /[\d,]/.test(ch))
  return keys.reduce((value, key) => applyKey(value, key, decimals), '')
}

/** True when the amount is worth paying (more than zero). */
export function isPayable(value: string): boolean {
  return /[1-9]/.test(value)
}
