import { useTranslation } from 'react-i18next'
import { LanguageSelect } from '@/components/LanguageSelect'
import { Page } from '@/components/Page'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'

export function Component() {
  const { t } = useTranslation()
  return (
    <Page title={t('settings.title')}>
      <div className="mt-8 flex flex-col gap-10">
        <LanguageSelect />
        <ThemeSwitcher />

        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="section-label">
            {t('settings.about')}
          </h2>
          <p className="mt-3 rounded-card bg-card px-5 py-4 text-card-foreground">
            {t('app.name')} · {t('settings.version', { version: __APP_VERSION__ })}
          </p>
        </section>
      </div>
    </Page>
  )
}
