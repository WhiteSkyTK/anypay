import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useBack } from '@/hooks/useBack'
import { cn } from '@/lib/utils'

interface BackButtonProps {
  /** Where to go when the page was opened directly and there is no in-app history. */
  fallback: string
  className?: string
}

/** The top-left "‹ Back" of iOS-style screens; a 3rem touch target. */
export function BackButton({ fallback, className }: Readonly<BackButtonProps>) {
  const { t } = useTranslation()
  const back = useBack(fallback)
  return (
    <button
      type="button"
      onClick={back}
      className={cn(
        '-ml-3 inline-flex min-h-12 items-center gap-0.5 rounded-full pr-4 pl-1.5 text-lg font-semibold text-primary print:hidden',
        className,
      )}
    >
      <ChevronLeft aria-hidden="true" className="size-6" />
      {t('common.back')}
    </button>
  )
}
