import { CircleCheck, CircleX, CloudOff, LoaderCircle, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { OutboxState } from '@/offline/store'
import { cn } from '@/lib/utils'

const LOOK: Record<OutboxState, { Icon: LucideIcon; className: string }> = {
  saved: { Icon: CloudOff, className: 'bg-muted text-foreground' },
  sending: { Icon: LoaderCircle, className: 'bg-muted text-foreground' },
  settled: { Icon: CircleCheck, className: 'bg-accent text-accent-foreground' },
  failed: { Icon: CircleX, className: 'bg-card text-destructive ring-1 ring-destructive/40' },
}

/** A voucher's sync state as an icon *and* a word: Saved offline, Sending, Settled, Failed. */
export function OutboxChip({ state }: Readonly<{ state: OutboxState }>) {
  const { t } = useTranslation()
  const { Icon, className } = LOOK[state]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn('size-3.5', state === 'sending' && 'animate-spin')} />
      {t(`voucher.states.${state}`)}
    </span>
  )
}
