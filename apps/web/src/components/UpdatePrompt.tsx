import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

/**
 * Registers the service worker and offers new versions instead of auto-reloading: a reload in
 * the middle of a payment would lose the customer's place.
 */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2 rounded-full border bg-card py-1.5 pr-1.5 pl-5 text-card-foreground shadow-lg">
        <output className="text-sm font-medium">{t('update.ready')}</output>
        <Button onClick={() => void updateServiceWorker(true)}>{t('update.reload')}</Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('update.dismiss')}
          onClick={() => setNeedRefresh(false)}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
