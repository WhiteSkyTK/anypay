import { zeroMoney } from '@anypay/shared'
import { Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { Page } from '@/components/Page'

/** Customer pay flow, reached by scanning a shop's QR poster. Keypad and quote: Phase 2. */
export function Component() {
  const { t } = useTranslation()
  const { shopId = '' } = useParams()
  return (
    <Page title={t('pay.title')}>
      <p className="mt-1 text-muted-foreground">{t('pay.shopCode', { shopId })}</p>

      <section aria-labelledby="amount-label" className="my-12 text-center">
        <h2 id="amount-label" className="section-label">
          {t('pay.amountLabel')}
        </h2>
        <Amount money={zeroMoney('ZAR', 2)} className="mt-2 block text-amount" />
      </section>

      <EmptyState
        icon={Store}
        title={t('pay.empty.title')}
        description={t('pay.empty.description')}
      />
    </Page>
  )
}
