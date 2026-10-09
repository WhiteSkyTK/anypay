import { useTranslation } from 'react-i18next'
import type { FeedState } from '@/hooks/useLiveFeed'
import { cn } from '@/lib/utils'

const DOT: Record<FeedState, string> = {
  live: 'bg-primary',
  loading: 'bg-muted-foreground',
  connecting: 'bg-muted-foreground',
  reconnecting: 'bg-warn',
  closed: 'bg-muted-foreground',
  unauthorized: 'bg-destructive',
}

/**
 * Whether the feed is live, as a dot *and* a word (never colour alone). A status region, so a
 * screen reader user hears when the feed drops and comes back.
 */
export function LiveIndicator({ state, online }: Readonly<{ state: FeedState; online: boolean }>) {
  const { t } = useTranslation()
  const shown: FeedState = online ? state : 'closed'
  const label = online ? t(`merchant.live.${shown}`) : t('merchant.live.offline')
  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm font-medium text-card-foreground"
    >
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full', DOT[shown], shown === 'live' && 'animate-pulse')}
      />
      {label}
    </span>
  )
}
