import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CLOCK_WARNING_MS, clockOffsetMs } from '@/lib/server-clock'

/**
 * Shown on the offline sale screens when this phone's clock is far off (learned from the last API
 * answer). AnyPay already corrects its voucher times, but the phone's clock should be fixed too.
 */
export function ClockWarning() {
  const { t } = useTranslation()
  const offset = Math.abs(clockOffsetMs())
  if (offset < CLOCK_WARNING_MS) return null
  return (
    <p className="mt-4 flex gap-2 rounded-card bg-card px-5 py-4 text-sm font-medium text-warn">
      <Clock aria-hidden="true" className="size-5 shrink-0" />
      {t('clock.warning', { minutes: Math.round(offset / 60_000) })}
    </p>
  )
}
