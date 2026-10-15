import { formatMoney, type PaymentSummary } from '@anypay/shared'
import { useTranslation } from 'react-i18next'
import { formatTime } from '@/lib/format'
import { Amount } from './Amount'
import { StatusChip } from './StatusChip'

/** One ledger card in the shop's feed (ledger-green reference): when, status, amount. */
export function PaymentRow({ payment }: Readonly<{ payment: PaymentSummary }>) {
  const { t } = useTranslation()
  const paidOther =
    payment.status === 'completed' &&
    payment.debitAmount &&
    payment.debitAmount.assetCode !== payment.amount.assetCode
  return (
    <li className="flex items-center justify-between gap-4 rounded-card bg-card px-5 py-4 text-card-foreground shadow-sm">
      <div className="flex min-w-0 flex-col gap-1.5">
        <time
          dateTime={payment.completedAt ?? payment.createdAt}
          className="text-sm text-muted-foreground"
        >
          {formatTime(payment.completedAt ?? payment.createdAt)}
        </time>
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusChip status={payment.status} />
          {payment.tabId && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
              {t('merchant.tab')}
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-col items-end text-right">
        <Amount money={payment.amount} className="text-2xl" />
        {paidOther && payment.debitAmount && (
          <span className="text-xs text-muted-foreground">
            {t('merchant.paidWith', { amount: formatMoney(payment.debitAmount) })}
          </span>
        )}
      </div>
    </li>
  )
}
