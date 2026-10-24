import { formatMoney } from '@anypay/shared'
import { ScanLine } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { Amount } from '@/components/Amount'
import { OutboxChip } from '@/components/OutboxChip'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { useOffline, useOfflineQuery } from '@/hooks/useOffline'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { api } from '@/lib/api'
import { formatDay, formatTime } from '@/lib/format'
import { resetsOn } from '@/lib/tabs'
import type { MyTabRow, OutboxRow } from '@/offline/store'

/** One tab: what's left this week, how to pay, and its payments as they settle. */
export function Component() {
  const { t } = useTranslation()
  const { tabId = '' } = useParams()
  const [params] = useSearchParams()
  const online = useOnlineStatus()
  const offline = useOffline()

  // With signal, refresh this tab from the server (e.g. just back from approving it).
  useEffect(() => {
    if (!offline || !online) return
    api.getTab(tabId).then(
      (tab) => offline.rememberTab(tab),
      () => undefined,
    )
  }, [offline, online, tabId])

  const view = useOfflineQuery(offline, tabId, async (store) => {
    const tab = await store.getDb().myTabs.get(tabId)
    const payments = await store.getDb().outbox.where('tabId').equals(tabId).toArray()
    return {
      tab,
      payments: payments.sort((a, b) => b.createdAt - a.createdAt),
      hasKey: await store.hasKeyFor(tabId),
      remaining: tab ? await store.remainingOn(tab) : undefined,
    }
  })

  const tab = view?.tab
  return (
    <Page title={tab?.shopName ?? t('tab.title')} back="/tab">
      {params.get('error') === 'callback' && (
        <p role="alert" className="mt-4 rounded-card bg-card px-5 py-4 text-destructive">
          {t('tab.detail.callbackError')}
        </p>
      )}
      {tab && <TabState tab={tab} hasKey={view.hasKey} remaining={view.remaining} />}
      {tab && (
        <Payments payments={view.payments} onRetry={(nonce) => void offline?.retryVoucher(nonce)} />
      )}
    </Page>
  )
}

function TabState({
  tab,
  hasKey,
  remaining,
}: Readonly<{ tab: MyTabRow; hasKey: boolean; remaining?: MyTabRow['remaining'] }>) {
  const { t, i18n } = useTranslation()
  if (tab.status === 'awaiting-consent')
    return <p className="mt-6 rounded-card bg-muted px-5 py-4">{t('tab.detail.waiting')}</p>
  if (tab.status === 'failed')
    return (
      <div className="mt-6 flex flex-col gap-4">
        <p className="rounded-card bg-muted px-5 py-4">{t('tab.detail.failed')}</p>
        <Button asChild size="lg">
          <Link to={`/shop/${tab.shopId}/tab`}>{t('tab.detail.openAgain')}</Link>
        </Button>
      </div>
    )
  const resets = formatDay(resetsOn(tab), i18n.resolvedLanguage)
  const usedUp = remaining?.value === '0'
  // The limit is approved in the customer's currency; the shop counts it in its own.
  const otherCurrency = tab.shopCap && tab.shopCap.assetCode !== tab.cap.assetCode
  return (
    <div className="mt-6 flex flex-col gap-6">
      <section aria-labelledby="left-label" className="text-center">
        <h2 id="left-label" className="section-label">
          {t('tab.leftThisWeek')}
        </h2>
        {remaining && <Amount money={remaining} className="mt-2 block text-amount" />}
        <p className="mt-2 text-muted-foreground">
          {t('tab.upTo', { amount: formatMoney(tab.cap) })} · {t('tab.resets', { date: resets })}
        </p>
        {otherCurrency && tab.shopCap && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t('tab.inShopCurrency', { amount: formatMoney(tab.shopCap), shop: tab.shopName })}
          </p>
        )}
      </section>
      {usedUp && (
        <div className="flex flex-col gap-4 rounded-card bg-card px-5 py-4 text-card-foreground">
          <p>{t('tab.detail.usedUp', { date: resets })}</p>
          <Button asChild size="lg" variant="secondary">
            <Link to={`/shop/${tab.shopId}/tab`}>{t('tab.detail.higherLimit')}</Link>
          </Button>
        </div>
      )}
      {hasKey ? (
        <>
          <p className="rounded-card bg-card px-5 py-4 text-card-foreground">
            {t('tab.detail.howToPay')}
          </p>
          <Button asChild size="lg">
            <Link to="/scan">
              <ScanLine aria-hidden="true" />
              {t('tab.detail.scan')}
            </Link>
          </Button>
        </>
      ) : (
        <p className="rounded-card bg-muted px-5 py-4">{t('tab.detail.otherPhone')}</p>
      )}
    </div>
  )
}

/** This tab's payments on this phone: Saved offline → Sending → Settled | Failed. */
export function Payments({
  payments,
  onRetry,
}: Readonly<{ payments: OutboxRow[]; onRetry: (nonce: string) => void }>) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="tab-payments" className="mt-10">
      <h2 id="tab-payments" className="section-label mb-3">
        {t('tab.detail.payments')}
      </h2>
      {payments.length === 0 && (
        <p className="text-muted-foreground">{t('tab.detail.noPayments')}</p>
      )}
      <ol className="flex flex-col gap-3" aria-live="polite">
        {payments.map((payment) => (
          <li
            key={payment.nonce}
            className="flex items-center justify-between gap-4 rounded-card bg-card px-5 py-4 text-card-foreground"
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <time
                dateTime={new Date(payment.ts * 1000).toISOString()}
                className="text-sm text-muted-foreground"
              >
                {formatTime(new Date(payment.ts * 1000).toISOString())}
              </time>
              <OutboxChip state={payment.state} />
              {payment.reason && (
                <span className="text-sm text-destructive">
                  {t(`voucher.reasons.${payment.reason}`)}
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Amount money={payment.amount} className="text-2xl" />
              {payment.state !== 'settled' && (
                <button
                  type="button"
                  onClick={() => onRetry(payment.nonce)}
                  className="min-h-12 text-sm font-semibold text-primary"
                >
                  {t('voucher.tryNow')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
