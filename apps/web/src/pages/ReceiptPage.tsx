import { formatMoney, type PaymentSummary } from '@anypay/shared'
import { CircleX, Clock, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { Amount } from '@/components/Amount'
import { DocumentTitle } from '@/components/Page'
import { SuccessTick } from '@/components/SuccessTick'
import { Button } from '@/components/ui/button'
import { usePaymentStatus } from '@/hooks/usePaymentStatus'
import { failureMessageKey } from '@/lib/error-message'
import { formatTime } from '@/lib/format'

function Frame({
  icon,
  title,
  children,
}: Readonly<{ icon: ReactNode; title: string; children?: ReactNode }>) {
  return (
    <div className="flex flex-col items-center text-center">
      {icon}
      <h1 tabIndex={-1} className="mt-6 text-title font-bold tracking-title focus:outline-none">
        {title}
      </h1>
      {children}
    </div>
  )
}

const spinner = <LoaderCircle aria-hidden="true" className="size-16 animate-spin text-primary" />

function Outcome({
  payment,
  callbackError,
}: Readonly<{ payment: PaymentSummary; callbackError: boolean }>) {
  const { t } = useTranslation()
  switch (payment.status) {
    case 'completed':
      return (
        <Frame icon={<SuccessTick />} title={t('receipt.completed.title')}>
          <Amount money={payment.amount} className="mt-4 block text-amount" />
          <p className="mt-3 text-lg">
            {t('receipt.completed.description', {
              shop: payment.shopName,
              amount: formatMoney(payment.amount),
            })}
          </p>
          {payment.debitAmount && (
            <p className="mt-1 text-muted-foreground">
              {t('receipt.completed.youPaid', { amount: formatMoney(payment.debitAmount) })}
            </p>
          )}
          {payment.completedAt && (
            <time dateTime={payment.completedAt} className="mt-1 text-sm text-muted-foreground">
              {formatTime(payment.completedAt)}
            </time>
          )}
        </Frame>
      )
    case 'failed':
      return (
        <Frame
          icon={<CircleX aria-hidden="true" className="size-20 text-destructive" />}
          title={t('receipt.failed.title')}
        >
          {payment.failure && (
            <p className="mt-3 max-w-sm text-lg">{t(failureMessageKey(payment.failure))}</p>
          )}
        </Frame>
      )
    case 'sending':
      return (
        <Frame icon={spinner} title={t('receipt.sending.title')}>
          <p className="mt-3 text-muted-foreground">{t('receipt.sending.description')}</p>
        </Frame>
      )
    default:
      return (
        <Frame
          icon={<Clock aria-hidden="true" className="size-20 text-muted-foreground" />}
          title={t('receipt.waiting.title')}
        >
          <p className="mt-3 max-w-sm text-muted-foreground">
            {callbackError ? t('receipt.callbackError') : t('receipt.waiting.description')}
          </p>
        </Frame>
      )
  }
}

/**
 * Where the customer lands after approving in their wallet: the payment's status, live until the
 * money has arrived (or it failed, with the reason and a way to try again).
 */
export function Component() {
  const { t } = useTranslation()
  const { paymentId = '' } = useParams()
  const [params] = useSearchParams()
  const { payment, stream } = usePaymentStatus(paymentId)
  const notFound = !payment && stream === 'closed'
  const final = payment?.status === 'completed' || payment?.status === 'failed'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <DocumentTitle title={t('receipt.title')} />
      <div aria-live="polite" className="flex flex-1 flex-col justify-center">
        {payment && (
          <Outcome payment={payment} callbackError={params.get('error') === 'callback'} />
        )}
        {!payment && !notFound && <Frame icon={spinner} title={t('receipt.loading')} />}
        {notFound && (
          <Frame
            icon={<CircleX aria-hidden="true" className="size-20 text-muted-foreground" />}
            title={t('receipt.notFound')}
          />
        )}
      </div>
      {payment && (final || payment.status === 'awaiting-consent') && (
        <Button
          asChild
          size="lg"
          variant={payment.status === 'completed' ? 'secondary' : 'default'}
        >
          <Link to={`/shop/${payment.shopId}/pay`}>{t('receipt.payAgain')}</Link>
        </Button>
      )}
    </div>
  )
}
