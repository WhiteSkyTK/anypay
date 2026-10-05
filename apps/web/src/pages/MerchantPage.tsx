import { zeroMoney } from '@anypay/shared'
import { ReceiptText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { Page } from '@/components/Page'

/** Merchant home: today's total and the live payment feed (Phase 2). */
export function Component() {
  const { t } = useTranslation()
  return (
    <Page title={t('merchant.title')}>
      <section aria-labelledby="total-label" className="my-12 text-center">
        <h2 id="total-label" className="section-label">
          {t('merchant.totalLabel')}
        </h2>
        <Amount money={zeroMoney('ZAR', 2)} className="mt-2 block text-amount" />
      </section>

      <section aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="section-label mb-3">
          {t('merchant.payments')}
        </h2>
        <EmptyState
          icon={ReceiptText}
          title={t('merchant.empty.title')}
          description={t('merchant.empty.description')}
        />
      </section>
    </Page>
  )
}
