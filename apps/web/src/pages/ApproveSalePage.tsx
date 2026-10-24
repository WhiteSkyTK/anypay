import {
  formatMoney,
  isFresh,
  type Money,
  parseSaleRequest,
  type Voucher,
  voucherPath,
} from '@anypay/shared'
import { CircleX } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { Amount } from '@/components/Amount'
import { ClockWarning } from '@/components/ClockWarning'
import { Page } from '@/components/Page'
import { QrCode } from '@/components/QrCode'
import { Button } from '@/components/ui/button'
import { useOffline, useOfflineQuery } from '@/hooks/useOffline'
import { type OfflineProblem, offlineProblemKey, offlineProblemOf } from '@/lib/offline-support'
import { formatDay } from '@/lib/format'
import { serverNow } from '@/lib/server-clock'
import { inCustomerCurrency, resetsOn } from '@/lib/tabs'

type Outcome =
  | { kind: 'idle' }
  | { kind: 'signed'; voucher: Voucher }
  | { kind: 'refused'; reason: 'no_tab' | 'cap_reached' }
  | { kind: 'failed'; problem: OfflineProblem }

/**
 * The customer's side of an offline sale. The shop's QR opened this page (in the app, or from the
 * phone's camera app); it works with no signal: the tab, its key and what's left this week are
 * all on this phone. Approving signs a voucher and shows it as a QR for the shop to scan.
 */
export function Component() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const request = parseSaleRequest(pathname)
  const offline = useOffline()
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })

  const view = useOfflineQuery(offline, request?.nonce ?? 'none', async (store) => {
    const tab = request ? await store.myTabAtShop(request.shopId) : undefined
    return { tab, remaining: tab ? await store.remainingOn(tab) : undefined }
  })

  if (!request) return <Refused message={t('approve.invalid')} />
  if (!isFresh(request.ts, serverNow())) return <Refused message={t('approve.expired')} />
  if (view && !view.tab)
    return (
      <Refused message={t('approve.noTab')}>
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link to={`/shop/${request.shopId}/tab`}>{t('tab.openHere')}</Link>
        </Button>
      </Refused>
    )
  if (!view?.tab?.shopCap) return null

  const tab = view.tab
  const amount: Money = { ...view.tab.shopCap, value: request.amount }
  const fromWallet = inCustomerCurrency(amount, tab)
  // Over what's left: say so before the customer taps, with when it resets and what else to do.
  const overLimit = view.remaining && BigInt(request.amount) > BigInt(view.remaining.value)
  const resets = formatDay(resetsOn(tab), i18n.resolvedLanguage)

  async function approve() {
    if (!offline || !request) return
    try {
      const result = await offline.approveSale(request)
      if (result.ok) setOutcome({ kind: 'signed', voucher: result.voucher })
      else setOutcome({ kind: 'refused', reason: result.reason })
    } catch (error_) {
      // Signing or saving failed: say so, rather than a button that seems to do nothing.
      setOutcome({ kind: 'failed', problem: offlineProblemOf(error_) })
    }
  }

  if (outcome.kind === 'signed') {
    const link = `${window.location.origin}${voucherPath(outcome.voucher)}`
    return (
      <Page title={t('approve.showShop')}>
        <div className="mx-auto mt-6 w-full max-w-xs rounded-card bg-white p-5">
          <QrCode
            value={link}
            label={t('approve.voucherLabel', { amount: formatMoney(amount) })}
            className="w-full"
          />
        </div>
        <Amount money={amount} className="mt-6 block text-center text-amount" />
        <Button asChild size="lg" className="mt-8 w-full">
          <Link to={`/tab/${view.tab.id}`}>{t('common.done')}</Link>
        </Button>
      </Page>
    )
  }

  return (
    <Page title={t('approve.title')} back={`/tab/${view.tab.id}`}>
      <section className="my-10 text-center" aria-labelledby="asks">
        <h2 id="asks" className="text-lg text-muted-foreground">
          {t('approve.asks', { shop: view.tab.shopName })}
        </h2>
        <Amount money={amount} className="mt-2 block text-amount" />
        {fromWallet && (
          <p className="mt-1 text-muted-foreground">
            {t('approve.fromWallet', { amount: formatMoney(fromWallet) })}
          </p>
        )}
        {view.remaining && (
          <p className="mt-3 text-muted-foreground">
            {t('approve.left', { amount: formatMoney(view.remaining) })}
          </p>
        )}
      </section>
      <ClockWarning />
      {(overLimit || (outcome.kind === 'refused' && outcome.reason === 'cap_reached')) && (
        <div role="alert" className="mb-6 flex flex-col gap-3 rounded-card bg-card px-5 py-4">
          <p className="text-destructive">{t('approve.capReached')}</p>
          <p className="text-card-foreground">{t('approve.capReachedNext', { date: resets })}</p>
          <Link
            to={`/shop/${tab.shopId}/tab`}
            className="inline-flex min-h-12 items-center font-semibold text-primary underline underline-offset-4"
          >
            {t('tab.detail.higherLimit')}
          </Link>
        </div>
      )}
      {outcome.kind === 'refused' && outcome.reason === 'no_tab' && (
        <p role="alert" className="mb-6 rounded-card bg-card px-5 py-4 text-destructive">
          {t('approve.noTab')}
        </p>
      )}
      {outcome.kind === 'failed' && (
        <p role="alert" className="mb-6 rounded-card bg-card px-5 py-4 text-destructive">
          {t(offlineProblemKey(outcome.problem))}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button size="lg" disabled={Boolean(overLimit)} onClick={() => void approve()}>
          {t('approve.approve')}
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link to={`/tab/${view.tab.id}`}>{t('common.cancel')}</Link>
        </Button>
      </div>
    </Page>
  )
}

function Refused({ message, children }: Readonly<{ message: string; children?: ReactNode }>) {
  const { t } = useTranslation()
  return (
    <Page title={t('approve.title')} back="/tab">
      <div className="mt-8 flex flex-col items-center gap-4 text-center">
        <CircleX aria-hidden="true" className="size-16 text-destructive" />
        <p role="alert" className="text-lg">
          {message}
        </p>
        {children}
      </div>
    </Page>
  )
}
