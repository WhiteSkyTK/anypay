import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'

// English is bundled so the first paint never waits on a network fetch. Further languages
// (one South African language, checked by a native speaker) can be lazy-loaded per locale.
export const resources = { en: { translation: en } } as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes output
})

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language
})

export default i18n
