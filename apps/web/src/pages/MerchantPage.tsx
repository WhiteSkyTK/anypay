import { formatMoney, type PaymentSummary } from '@anypay/shared'
import { Download, LoaderCircle, QrCode as QrIcon, ReceiptText, Store } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { LiveIndicator } from '@/components/LiveIndicator'
import { Page } from '@/components/Page'
import { PaymentRow } from '@/components/PaymentRow'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/ui/button'
import { useErrorText } from '@/hooks/useErrorText'
import { useLiveFeed } from '@/hooks/useLiveFeed'
import { useMerchantSession } from '@/hooks/useMerchantSession'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useVoiceConfirm } from '@/hooks/useVoiceConfirm'
import { api } from '@/lib/api'
import { errorMessageKey } from '@/lib/error-message'
import { downloadBlob, startOfToday } from '@/lib/format'
import { type MerchantSession, setMerchantSession } from '@/lib/merchant-session'

const quickAction =
  'flex flex-col items-center gap-2 text-sm font-semibold disabled:opacity-50 [&>span]:grid [&>span]:size-14 [&>span]:place-items-center [&>span]:rounded-full [&>span]:bg-card [&>span]:text-card-foreground [&>span]:shadow-sm'

/** Feature 3: today's total and every payment the moment it lands, announced out loud if wanted. */
function ShopFeed({ session }: Readonly<{ session: MerchantSession }>) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const online = useOnlineStatus()
  const voice = useVoiceConfirm()
  const [announcement, setAnnouncement] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string>()
  // Each payment is announced once, when it completes, never again on reconnect snapshots.
  const announced = useRef(new Set<string>())

  const onPayment = useCallback(
    (payment: PaymentSummary) => {
      if (payment.status !== 'completed' || announced.current.has(payment.id)) return
      announced.current.add(payment.id)
      const amount = formatMoney(payment.amount)
      setAnnouncement(t('merchant.newPayment', { amount }))
      voice.announce('merchant.voice.received', { amount })
    },
    [t, voice],
  )
  const feed = useLiveFeed(session, onPayment)

  async function exportCsv() {
    setExporting(true)
    setExportError(undefined)
    try {
      const blob = await api.exportCsv(session.shopId, session.token, startOfToday())
      downloadBlob(blob, `anypay-${session.shopId}-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (error) {
      setExportError(errorMessageKey(error))
    } finally {
      setExporting(false)
    }
  }

  if (feed.state === 'unauthorized') {
    return (
      <div className="mt-8 flex flex-col gap-6">
        <EmptyState
          icon={Store}
          title={t('merchant.unauthorized.title')}
          description={t('merchant.unauthorized.description')}
        />
        <Button size="lg" onClick={() => setMerchantSession(null)}>
          {t('merchant.unauthorized.reset')}
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="mt-3">
        <LiveIndicator state={feed.state} online={online} />
      </div>

      <section aria-labelledby="total-label" className="my-10 text-center">
        <h2 id="total-label" className="section-label">
          {t('merchant.totalLabel')}
        </h2>
        {feed.state === 'loading' ? (
          <div
            aria-hidden="true"
            className="mx-auto mt-3 h-16 w-48 animate-pulse rounded-card bg-muted"
          />
        ) : (
          <Amount money={feed.total} className="mt-2 block text-amount" />
        )}
      </section>

      <div className="flex justify-center gap-10">
        <Link to="/merchant/poster" className={quickAction}>
          <span>
            <QrIcon aria-hidden="true" className="size-6" />
          </span>
          {t('merchant.actions.poster')}
        </Link>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || !online}
          className={quickAction}
        >
          <span>
            {exporting ? (
              <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
            ) : (
              <Download aria-hidden="true" className="size-6" />
            )}
          </span>
          {exporting ? t('merchant.actions.exporting') : t('merchant.actions.export')}
        </button>
      </div>
      {exportError && (
        <p role="alert" className="mt-3 text-center text-sm text-destructive">
          {errorText(exportError)}
        </p>
      )}

      <div className="mt-8">
        <Switch
          label={voice.supported ? t('merchant.voice.label') : t('merchant.voice.unsupported')}
          checked={voice.enabled && voice.supported}
          onChange={voice.setEnabled}
          disabled={!voice.supported}
        />
      </div>

      <section aria-labelledby="payments-heading" className="mt-10">
        <h2 id="payments-heading" className="section-label mb-3">
          {t('merchant.payments')}
        </h2>
        {feed.state === 'loading' && (
          <div aria-hidden="true" className="flex flex-col gap-3">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-20 animate-pulse rounded-card bg-muted" />
            ))}
          </div>
        )}
        {feed.state !== 'loading' && feed.payments.length === 0 && (
          <EmptyState
            icon={ReceiptText}
            title={t('merchant.empty.title')}
            description={t('merchant.empty.description')}
          />
        )}
        {feed.payments.length > 0 && (
          <ol className="flex flex-col gap-3">
            {feed.payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </ol>
        )}
      </section>

      {/* Screen readers hear each new payment without leaving what they're doing. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  )
}

export function Component() {
  const { t } = useTranslation()
  const session = useMerchantSession()

  if (!session) {
    return (
      <Page title={t('merchant.title')}>
        <div className="mt-8 flex flex-col gap-6">
          <EmptyState
            icon={Store}
            title={t('merchant.setUp.title')}
            description={t('merchant.setUp.description')}
          />
          <Button asChild size="lg">
            <Link to="/merchant/new">{t('merchant.setUp.cta')}</Link>
          </Button>
        </div>
      </Page>
    )
  }

  return (
    <Page title={session.name}>
      <ShopFeed session={session} />
    </Page>
  )
}
