import { useTranslation } from 'react-i18next'
import { Page } from '@/components/Page'

const REPO_URL = 'https://github.com/WhiteSkyTK/anypay'

// What AnyPay stores, where, and for how long: plain answers for shop owners and customers, and
// the POPIA openness notice. Keep it in step with the API's schema (apps/api/src/db/schema.ts).
const SECTIONS = [
  {
    heading: 'privacy.shop.heading',
    items: ['privacy.shop.details', 'privacy.shop.key'],
  },
  {
    heading: 'privacy.payment.heading',
    items: [
      'privacy.payment.amounts',
      'privacy.payment.encrypted',
      'privacy.payment.shopSees',
      'privacy.payment.tab',
    ],
  },
  {
    heading: 'privacy.phone.heading',
    items: ['privacy.phone.settings', 'privacy.phone.offline', 'privacy.phone.tab'],
  },
  { heading: 'privacy.never.heading', items: ['privacy.never.items'] },
  {
    heading: 'privacy.others.heading',
    items: ['privacy.others.wallet', 'privacy.others.hosting', 'privacy.others.logs'],
  },
  { heading: 'privacy.keep.heading', items: ['privacy.keep.demo'] },
] as const

export function Component() {
  const { t } = useTranslation()

  return (
    <Page title={t('privacy.title')} back="/">
      <p className="mt-2 text-lg text-muted-foreground">{t('privacy.intro')}</p>

      <div className="mt-8 flex flex-col gap-8 pb-12">
        {SECTIONS.map(({ heading, items }) => (
          <section key={heading} aria-labelledby={heading.replaceAll('.', '-')}>
            <h2 id={heading.replaceAll('.', '-')} className="section-label">
              {t(heading)}
            </h2>
            <ul className="mt-3 flex flex-col gap-3 rounded-card bg-card px-5 py-4 text-card-foreground">
              {items.map((item) => (
                <li key={item}>{t(item)}</li>
              ))}
            </ul>
          </section>
        ))}

        <section aria-labelledby="privacy-rights">
          <h2 id="privacy-rights" className="section-label">
            {t('privacy.rights.heading')}
          </h2>
          <div className="mt-3 rounded-card bg-card px-5 py-4 text-card-foreground">
            <p>{t('privacy.rights.body')}</p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-12 items-center font-semibold text-primary underline underline-offset-4"
            >
              {t('privacy.rights.contact')}
            </a>
          </div>
        </section>
      </div>
    </Page>
  )
}
