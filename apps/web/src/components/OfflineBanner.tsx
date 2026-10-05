import { WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/** Always-mounted live region, so screen readers announce going offline and back online. */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const { t } = useTranslation()
  return (
    <div role="status" aria-live="polite" className="sticky top-0 z-50">
      {!online && (
        <p className="flex items-center justify-center gap-2 bg-foreground px-4 py-2 text-center text-sm font-medium text-background">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          {t('offline.banner')}
        </p>
      )}
    </div>
  )
}
