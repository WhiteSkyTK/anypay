import { formatMoney, type Quote } from '@anypay/shared'
import { LoaderCircle, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTime } from '@/lib/format'
import { Amount } from './Amount'
import { Button } from './ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from './ui/drawer'

interface QuoteSheetProps {
  open: boolean
  shopName: string
  quote: Quote
  redirecting: boolean
  onApprove: () => void
  onCancel: () => void
}

/**
 * The exact price before anything is paid (CLAUDE.md step 3): what leaves the customer's wallet,
 * fees and exchange rate included, next to what the shop receives. The customer then approves
 * in their own wallet; AnyPay never sees their credentials.
 */
export function QuoteSheet({
  open,
  shopName,
  quote,
  redirecting,
  onApprove,
  onCancel,
}: Readonly<QuoteSheetProps>) {
  const { t } = useTranslation()
  return (
    <Drawer open={open} onOpenChange={(next) => !next && !redirecting && onCancel()}>
      <DrawerContent>
        <DrawerTitle>{t('pay.quote.title')}</DrawerTitle>
        <DrawerDescription className="mt-1">{t('pay.quote.includes')}</DrawerDescription>

        <div className="my-8 text-center">
          <p className="section-label">{t('pay.quote.youPay')}</p>
          <Amount money={quote.debitAmount} className="mt-2 block text-amount" />
        </div>

        <dl className="flex flex-col gap-3 rounded-card bg-muted px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{t('pay.quote.shopGets', { shop: shopName })}</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(quote.receiveAmount)}</dd>
          </div>
          {quote.expiresAt && (
            <div className="text-sm text-muted-foreground">
              {t('pay.quote.validUntil', { time: formatTime(quote.expiresAt) })}
            </div>
          )}
        </dl>

        <Button size="lg" className="mt-8 w-full" onClick={onApprove} disabled={redirecting}>
          {redirecting ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Wallet aria-hidden="true" />
          )}
          {redirecting ? t('pay.quote.redirecting') : t('pay.quote.approve')}
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={onCancel} disabled={redirecting}>
          {t('common.cancel')}
        </Button>
      </DrawerContent>
    </Drawer>
  )
}
