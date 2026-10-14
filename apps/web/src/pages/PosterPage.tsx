import { Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { BackButton } from '@/components/BackButton'
import { LogoMark } from '@/components/LogoMark'
import { DocumentTitle } from '@/components/Page'
import { QrCode } from '@/components/QrCode'
import { Button } from '@/components/ui/button'
import { useMerchantSession } from '@/hooks/useMerchantSession'

/** New codes are 8 characters: printed in two groups of 4, easy to read out and type. */
const printable = (code: string) =>
  /^[2-9A-Z]{8}$/.test(code) ? `${code.slice(0, 4)} ${code.slice(4)}` : code

/**
 * Feature 1's output: an A5 poster the shop prints once. The QR opens the shop's pay page in any
 * phone's camera app, so customers need no app and the shop needs no card machine. The poster is
 * paper, so it is always black on white, whatever the app theme.
 */
export function Component() {
  const { t } = useTranslation()
  const session = useMerchantSession()
  const navigate = useNavigate()
  // Opened from the shop's feed: going "to my shop" is going back, so history doesn't pile up.
  const fromFeed = (useLocation().state as { from?: string } | null)?.from === 'feed'
  if (!session) return <Navigate to="/merchant/new" replace />

  const toShop = () => {
    if (fromFeed) void navigate(-1)
    else void navigate('/merchant', { replace: true })
  }
  const payUrl = `${window.location.origin}/shop/${session.shopId}/pay`
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-10 print:max-w-none print:p-0">
      <DocumentTitle title={t('poster.title')} />
      <div className="print:hidden">
        <BackButton fallback="/merchant" className="mb-2" />
        <h1 tabIndex={-1} className="text-title font-bold tracking-title focus:outline-none">
          {t('poster.title')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('poster.hint')}</p>
      </div>

      <article className="mx-auto mt-6 flex aspect-[148/210] w-full max-w-sm flex-col items-center justify-between rounded-card bg-white p-8 text-center text-black shadow-lg print:mt-0 print:h-screen print:w-screen print:max-w-none print:rounded-none print:p-12 print:shadow-none">
        <p className="flex items-center gap-2 text-lg font-bold">
          <LogoMark className="size-8" />
          {t('app.name')}
        </p>
        <div>
          <p className="text-3xl font-bold tracking-title text-balance">{session.name}</p>
          <p className="mt-2 text-2xl font-semibold">{t('poster.scanToPay')}</p>
        </div>
        <QrCode
          value={payUrl}
          label={t('poster.qrLabel', { shop: session.name })}
          className="w-full max-w-64"
        />
        <div className="text-sm">
          <p className="font-semibold">{t('poster.anyWallet')}</p>
          <p className="mt-1 break-all text-neutral-700">
            {t('poster.orOpen')} {payUrl.replace(/^https?:\/\//, '')}
          </p>
          <p className="mt-2 text-neutral-700">
            {t('poster.code')}{' '}
            <strong className="text-base tracking-widest text-black">
              {printable(session.shopId)}
            </strong>
          </p>
        </div>
      </article>

      <div className="mt-8 flex flex-col gap-3 print:hidden">
        <Button size="lg" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          {t('poster.print')}
        </Button>
        <Button size="lg" variant="ghost" onClick={toShop}>
          {t('poster.done')}
        </Button>
      </div>
    </div>
  )
}
