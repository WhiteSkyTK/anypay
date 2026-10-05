import 'i18next'
import type en from './locales/en.json'

// Type-checked translation keys: a typo in t('...') fails the build instead of showing raw keys.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof en }
  }
}
