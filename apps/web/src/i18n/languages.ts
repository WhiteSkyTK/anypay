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
 * The person's saved choice wins; otherwise the first phone language we support ('zu-ZA' → 'zu'),
 * so a phone set to isiZulu opens in isiZulu without anyone touching settings.
 */
export function detectLanguage(stored: unknown, preferred: readonly string[]): LanguageCode {
  if (isLanguageCode(stored)) return stored
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0]
    if (isLanguageCode(base)) return base
  }
  return DEFAULT_LANGUAGE
}
