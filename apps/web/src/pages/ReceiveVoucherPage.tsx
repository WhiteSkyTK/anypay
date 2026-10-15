import { type Money, parseVoucher, type Voucher } from '@anypay/shared'
import { CircleCheck, CircleX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router'
import { Amount } from '@/components/Amount'
import { OutboxChip } from '@/components/OutboxChip'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { useMerchantSession } from '@/hooks/useMerchantSession'
import { type OfflineModule, useOffline, useOfflineQuery } from '@/hooks/useOffline'
import type { MerchantSession } from '@/lib/merchant-session'

type CheckResult = Awaited<ReturnType<OfflineModule['checkVoucher']>>

function failureOf(voucher: Voucher | null, check: CheckResult | undefined) {
  if (!voucher) return 'invalid'
  return check && !check.ok ? check.reason : undefined
}

/**
 * The shop scanned a customer's voucher (/v/…). Checked on this phone with no signal needed, then
 * kept in the outbox: "Saved – settles when online". Either phone settling it first is fine.
 */
export function Component() {
  const session = useMerchantSession()
  const { pathname } = useLocation()
  if (!session) return <Navigate to="/merchant/new" replace />
  return <Receive session={session} voucher={parseVoucher(pathname)} />
}

function Receive({
  session,
  voucher,
}: Readonly<{ session: MerchantSession; voucher: Voucher | null }>) {
  const { t } = useTranslation()
  const offline = useOffline()
  const [check, setCheck] = useState<CheckResult>()
  const started = useRef(false)

  useEffect(() => {
    if (!offline || !voucher || started.current) return
    started.current = true // once, even if React runs effects twice
    void offline.checkVoucher(voucher, session).then(async (result) => {
      if (result.ok) await offline.acceptVoucher(voucher, result.tab)
      setCheck(result)
    })
  }, [offline, voucher, session])

  const row = useOfflineQuery(offline, voucher?.nonce ?? 'none', (store) =>
    voucher ? store.getDb().outbox.get(voucher.nonce) : Promise.resolve(undefined),
  )

  const amount: Money | undefined = voucher
    ? {
        value: voucher.amount,
        assetCode: session.assetCode,
        assetScale: session.assetScale,
      }
    : undefined
  const failure = failureOf(voucher, check)

  return (
    <Page title={t('voucher.title')} back="/merchant">
      <div aria-live="polite" className="mt-8 flex flex-col items-center gap-4 text-center">
        {failure ? (
          <>
            <CircleX aria-hidden="true" className="size-16 text-destructive" />
            <p role="alert" className="text-lg">
              {t(`voucher.check.${failure}`)}
            </p>
          </>
        ) : (
          check?.ok && (
            <>
              <CircleCheck aria-hidden="true" className="size-16 text-primary" />
              {amount && <Amount money={amount} className="text-amount" />}
              <p className="text-lg">{t('voucher.from', { label: check.tab.label })}</p>
              {row && row.state !== 'settled' && row.state !== 'failed' ? (
                <p className="font-semibold">{t('voucher.saved')}</p>
              ) : null}
              {row && <OutboxChip state={row.state} />}
            </>
          )
        )}
      </div>
      <Button asChild size="lg" className="mt-10 w-full">
        <Link to="/merchant">{t('voucher.backToShop')}</Link>
      </Button>
    </Page>
  )
}
