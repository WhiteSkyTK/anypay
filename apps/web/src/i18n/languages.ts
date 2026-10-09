/** Languages AnyPay ships, each named in itself so people can find their own. */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'nso', name: 'Sepedi' },
  { code: 'xh', name: 'isiXhosa' },
  { code: 'zu', name: 'isiZulu' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE = 'en' satisfies LanguageCode
export const LANGUAGE_STORAGE_KEY = 'anypay.language'

const CODES: readonly string[] = LANGUAGES.map((language) => language.code)

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && CODES.includes(value)
}

/**
 * Everyone starts in English (a predictable first screen for a demo and for shared phones); once
 * someone picks a language, that choice is remembered on the phone.
 */
export function initialLanguage(stored: unknown): LanguageCode {
  return isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE
}
