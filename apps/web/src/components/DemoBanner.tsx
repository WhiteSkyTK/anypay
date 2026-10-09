import { FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApiConfig } from '@/hooks/useApiConfig'

/** Shown when the API runs with DEMO_MODE: nobody mistakes test money for real money. */
export function DemoBanner() {
  const { t } = useTranslation()
  const config = useApiConfig()
  if (!config?.demoMode) return null
  return (
    <p className="flex items-center justify-center gap-2 bg-warn px-4 py-1.5 text-center text-sm font-semibold text-warn-foreground print:hidden">
      <FlaskConical aria-hidden="true" className="size-4" />
      {t('demo.banner')}
    </p>
  )
}
