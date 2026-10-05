import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  DEFAULT_LANGUAGE,
  detectLanguage,
  LANGUAGE_STORAGE_KEY,
  LANGUAGES,
  type LanguageCode,
} from './languages'
import en from './locales/en.json'

type Translations = typeof en

// English is bundled so the first paint never waits on a fetch. Other languages are separate
// chunks: a phone downloads only its own language, and the service worker precaches all of them.
// Typing the loaders as `typeof en` makes a locale missing a key fail the build.
const loaders: Record<Exclude<LanguageCode, 'en'>, () => Promise<{ default: Translations }>> = {
  nso: () => import('./locales/nso.json'),
  xh: () => import('./locales/xh.json'),
  zu: () => import('./locales/zu.json'),
}

async function loadLanguage(code: LanguageCode): Promise<void> {
  if (code === DEFAULT_LANGUAGE || i18n.hasResourceBundle(code, 'translation')) return
  const { default: translations } = await loaders[code]()
  i18n.addResourceBundle(code, 'translation', translations)
}

function readStoredLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Switches language and remembers the choice on this phone. */
export async function setLanguage(code: LanguageCode): Promise<void> {
  await loadLanguage(code)
  await i18n.changeLanguage(code)
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code)
  } catch {
    // Not remembered, but still applied for this visit.
  }
}

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language
})

/** Resolves once the starting language is ready, so the first render is already translated. */
export async function initI18n(): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: LANGUAGES.map((language) => language.code),
    interpolation: { escapeValue: false }, // React already escapes output
  })
  const initial = detectLanguage(readStoredLanguage(), navigator.languages)
  if (initial === DEFAULT_LANGUAGE) return
  try {
    await loadLanguage(initial)
    await i18n.changeLanguage(initial)
  } catch {
    // A missing chunk (e.g. first visit while offline) falls back to English instead of a blank app.
  }
}

export default i18n
