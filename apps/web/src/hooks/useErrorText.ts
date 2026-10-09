import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Translates an error key that may come from the API at run time (so it can't be type-checked),
 * falling back to the general message if this version of the app doesn't know it.
 */
export function useErrorText(): (key: string) => string {
  const { t } = useTranslation()
  return useCallback(
    (key: string) => t(key as 'errors.api.unknown', { defaultValue: t('errors.api.unknown') }),
    [t],
  )
}
