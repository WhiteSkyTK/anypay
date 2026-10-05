import { formatMoney, splitMoneyForDisplay, type Money } from '@anypay/shared'
import { cn } from '@/lib/utils'

interface AmountProps {
  money: Money
  className?: string
}

/**
 * The biggest thing on screen: whole units large, cents at half size, tabular digits so
 * amounts don't jitter as they change. Screen readers get the plain formatted amount.
 */
export function Amount({ money, className }: Readonly<AmountProps>) {
  const { whole, fraction } = splitMoneyForDisplay(money)
  return (
    <span className={cn('font-bold tracking-title tabular-nums', className)}>
      <span className="sr-only">{formatMoney(money)}</span>
      <span aria-hidden="true">
        {whole}
        <span className="text-[0.5em]">{fraction}</span>
      </span>
    </span>
  )
}
