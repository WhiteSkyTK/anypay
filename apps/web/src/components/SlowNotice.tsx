import { LoaderCircle } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isSlow, subscribeSlow } from '@/lib/pending-requests'

/**
 * "Still working…" once a request has waited a few seconds: a free server waking from sleep takes
 * up to a minute, and without this the app looks frozen. Hidden offline (the offline banner says
 * why nothing is moving). Always mounted, so screen readers hear it appear.
 */
export function SlowNotice() {
  const { t } = useTranslation()
  const online = useOnlineStatus()
  const slow = useSyncExternalStore(subscribeSlow, isSlow, () => false)
  return (
    <output aria-live="polite" className="sticky top-0 z-50 block">
      {slow && online && (
        <span className="flex items-center justify-center gap-2 bg-muted px-4 py-2 text-center text-sm font-medium text-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" />
          {t('slow.notice')}
        </span>
      )}
    </output>
  )
}
