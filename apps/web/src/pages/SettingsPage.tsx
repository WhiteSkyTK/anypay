import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSelect } from '@/components/LanguageSelect'
import { Page } from '@/components/Page'
import { Switch } from '@/components/Switch'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { useApiConfig } from '@/hooks/useApiConfig'
import {
  isSimulatedOffline,
  setSimulatedOffline,
  subscribeSimulatedOffline,
} from '@/lib/simulated-offline'

export function Component() {
  const { t } = useTranslation()
  const config = useApiConfig()
  const simulated = useSyncExternalStore(subscribeSimulatedOffline, isSimulatedOffline)

  return (
    <Page title={t('settings.title')}>
      <div className="mt-8 flex flex-col gap-10">
        <LanguageSelect />
        <ThemeSwitcher />

        {/* Demo only; always shown while on, so it can be switched off even with no signal. */}
        {(config?.demoMode || simulated) && (
          <section className="flex flex-col gap-2">
            <Switch
              label={t('settings.simulateOffline')}
              checked={simulated}
              onChange={setSimulatedOffline}
            />
            <p className="px-1 text-sm text-muted-foreground">
              {t('settings.simulateOfflineHint')}
            </p>
          </section>
        )}

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
