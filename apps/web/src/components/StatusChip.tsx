import type { PaymentStatus } from '@anypay/shared'
import { CircleCheck, CircleX, Clock, LoaderCircle, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type Tone = 'done' | 'failed' | 'pending'

const TONE_OF: Record<PaymentStatus, Tone> = {
  created: 'pending',
  'incoming-payment-created': 'pending',
  quoted: 'pending',
  'awaiting-consent': 'pending',
  sending: 'pending',
  completed: 'done',
  failed: 'failed',
}

const ICON_OF: Record<Tone, LucideIcon> = { done: CircleCheck, failed: CircleX, pending: Clock }

const TONE_CLASS: Record<Tone, string> = {
  done: 'bg-accent text-accent-foreground',
  failed: 'bg-card text-destructive ring-1 ring-destructive/40',
  pending: 'bg-muted text-foreground',
}

/** Payment status as an icon *and* a word, so it never depends on colour alone. */
export function StatusChip({ status }: Readonly<{ status: PaymentStatus }>) {
  const { t } = useTranslation()
  const tone = TONE_OF[status]
  const Icon = status === 'sending' ? LoaderCircle : ICON_OF[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        TONE_CLASS[tone],
      )}
    >
      <Icon aria-hidden="true" className={cn('size-3.5', status === 'sending' && 'animate-spin')} />
      {t(`status.${status}`)}
    </span>
  )
}
