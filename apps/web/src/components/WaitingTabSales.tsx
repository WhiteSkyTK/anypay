import { useTranslation } from 'react-i18next'
import { useOffline, useOfflineQuery } from '@/hooks/useOffline'
import { Amount } from './Amount'
import { OutboxChip } from './OutboxChip'

/**
 * Tab sales this phone took that haven't settled yet (or failed): Saved offline, Sending, Failed
 * with the reason and "Try now". Settled ones join the feed below as ordinary payments.
 */
export function WaitingTabSales({ shopId }: Readonly<{ shopId: string }>) {
  const { t } = useTranslation()
  // Tabs are an extra on the feed: if this phone can't keep them, the feed works without.
  const offline = useOffline({ quiet: true })
  const rows = useOfflineQuery(offline, shopId, (store) => store.listShopOutbox(shopId), {
    quiet: true,
  })
  const waiting = rows?.filter((row) => row.state !== 'settled') ?? []
  if (waiting.length === 0) return null
  return (
    <section aria-labelledby="waiting-heading" className="mt-10">
      <h2 id="waiting-heading" className="section-label mb-3">
        {t('voucher.waiting')}
      </h2>
      <ol className="flex flex-col gap-3" aria-live="polite">
        {waiting.map((row) => (
          <li
            key={row.nonce}
            className="flex items-center justify-between gap-4 rounded-card bg-card px-5 py-4 text-card-foreground"
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <OutboxChip state={row.state} />
              {row.reason && (
                <span className="text-sm text-destructive">
                  {t(`voucher.reasons.${row.reason}`)}
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Amount money={row.amount} className="text-2xl" />
              <button
                type="button"
                onClick={() => void offline?.retryVoucher(row.nonce)}
                className="min-h-12 text-sm font-semibold text-primary"
              >
                {t('voucher.tryNow')}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
