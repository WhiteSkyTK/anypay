import type { Money } from '@anypay/shared'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** When a tab's weekly limit starts again: a week after the current week began. */
export const resetsOn = (tab: { weekStartedAt: string }) =>
  new Date(Date.parse(tab.weekStartedAt) + WEEK_MS)

/**
 * Roughly what a sale in the shop's currency takes from the customer's wallet, at the rate the
 * tab was opened with (the weekly limit in both currencies). "About": each payment's own fees and
 * the day's exchange rate make it a little different. Undefined when both use the same currency.
 */
export function inCustomerCurrency(
  amount: Money,
  tab: { cap: Money; shopCap?: Money },
): Money | undefined {
  const { cap, shopCap } = tab
  if (!shopCap || shopCap.assetCode === cap.assetCode || shopCap.value === '0') return undefined
  const value = (BigInt(amount.value) * BigInt(cap.value)) / BigInt(shopCap.value)
  return { ...cap, value: value.toString() }
}
