import {
  formatMoney,
  type Money,
  newNonce,
  type SaleRequest,
  saleRequestPath,
  toMinorUnits,
} from '@anypay/shared'
import { BookOpen, ScanLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { Keypad } from '@/components/Keypad'
import { Page } from '@/components/Page'
import { QrCode } from '@/components/QrCode'
import { Button } from '@/components/ui/button'
import { useMerchantSession } from '@/hooks/useMerchantSession'
import { useOffline, useOfflineQuery } from '@/hooks/useOffline'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { applyKey, isPayable } from '@/lib/keypad'
import type { MerchantSession } from '@/lib/merchant-session'

/**
 * A sale to a customer with a tab, with or without signal: the shop types the amount and shows a
 * QR; the customer's phone approves it and shows a QR back, which the shop scans (/v/…).
 */
export function Component() {
  const session = useMerchantSession()
  if (!session) return <Navigate to="/merchant/new" replace />
  return <TabSale session={session} />
}

function TabSale({ session }: Readonly<{ session: MerchantSession }>) {
  const { t } = useTranslation()
  const online = useOnlineStatus()
  const offline = useOffline()
  const [typed, setTyped] = useState('')
  const [request, setRequest] = useState<SaleRequest | null>(null)
  const [syncFailed, setSyncFailed] = useState(false)

  // With signal, download the shop's tabs (keys and caps) so later sales work with none.
  useEffect(() => {
    if (!offline || !online) return
    offline.refreshShopTabs(session).then(
      () => setSyncFailed(false),
      () => setSyncFailed(true),
    )
  }, [offline, online, session])

  const tabs = useOfflineQuery(offline, session.shopId, (store) =>
    store.listShopTabs(session.shopId),
  )

  if (tabs?.length === 0)
    return (
      <Page title={t('sale.title')} back="/merchant">
        <div className="mt-8">
          <EmptyState
            icon={BookOpen}
            title={t('sale.noTabs.title')}
            description={t('sale.noTabs.description')}
          />
        </div>
      </Page>
    )

  const asset = { assetCode: session.assetCode, assetScale: session.assetScale }
  if (request) {
    const amount: Money = { ...asset, value: request.amount }
    return (
      <Page title={t('sale.title')} back="/merchant">
        <Amount money={amount} className="mt-6 block text-center text-amount" />
        <div className="mx-auto mt-6 w-full max-w-xs rounded-card bg-white p-5">
          <QrCode
            value={`${window.location.origin}${saleRequestPath(request)}`}
            label={t('sale.qrLabel', { amount: formatMoney(amount) })}
            className="w-full"
          />
        </div>
        <p className="mt-6 text-center text-muted-foreground">{t('sale.askCustomer')}</p>
        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg">
            <Link to="/scan">
              <ScanLine aria-hidden="true" />
              {t('sale.scanVoucher')}
            </Link>
          </Button>
          <Button size="lg" variant="ghost" onClick={() => setRequest(null)}>
            {t('sale.newSale')}
          </Button>
        </div>
      </Page>
    )
  }

  function showQr() {
    const value = toMinorUnits(typed.replace(',', '.'), session.assetScale)
    setRequest({
      shopId: session.shopId,
      amount: value,
      nonce: newNonce(),
      ts: Math.floor(Date.now() / 1000),
    })
  }

  return (
    <Page title={t('sale.title')} back="/merchant">
      <p className="mt-1 text-muted-foreground">{t('sale.hint')}</p>
      {syncFailed && <p className="mt-4 rounded-card bg-muted px-5 py-4">{t('sale.syncFailed')}</p>}
      {tabs && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('sale.tabsOnPhone', { count: tabs.length })}
        </p>
      )}
      <p
        className="my-8 text-center text-amount font-bold tracking-title tabular-nums"
        aria-live="polite"
      >
        {typed ? `${session.assetCode} ${typed}` : `${session.assetCode} 0`}
      </p>
      <Keypad
        decimals={session.assetScale}
        onKey={(key) => setTyped((current) => applyKey(current, key, session.assetScale))}
      />
      <Button size="lg" className="mt-6 w-full" disabled={!isPayable(typed)} onClick={showQr}>
        {t('sale.showQr')}
      </Button>
    </Page>
  )
}
