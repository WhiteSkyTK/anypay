import { ChevronRight } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LanguageSelect } from '@/components/LanguageSelect'
import { Page } from '@/components/Page'
import { Switch } from '@/components/Switch'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { useApiConfig } from '@/hooks/useApiConfig'
import { useMerchantSession } from '@/hooks/useMerchantSession'
import {
  isSimulatedOffline,
  setSimulatedOffline,
  subscribeSimulatedOffline,
} from '@/lib/simulated-offline'

export function Component() {
  const { t } = useTranslation()
  const config = useApiConfig()
  const simulated = useSyncExternalStore(subscribeSimulatedOffline, isSimulatedOffline)
  const session = useMerchantSession()

  return (
    <Page title={t('settings.title')}>
      <div className="mt-8 flex flex-col gap-10">
        <LanguageSelect />
        <ThemeSwitcher />

        {session && (
          <section aria-labelledby="shop-heading">
            <h2 id="shop-heading" className="section-label">
              {t('settings.shop')}
            </h2>
            <Link
              to="/merchant/phones"
              className="mt-3 flex min-h-14 items-center justify-between gap-4 rounded-card bg-card px-5 py-3 font-semibold text-card-foreground"
            >
              {t('settings.otherPhones')}
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </Link>
          </section>
        )}

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
          <div className="mt-3 flex flex-col rounded-card bg-card px-5 py-2 text-card-foreground">
            <p className="py-2">
              {t('app.name')} · {t('settings.version', { version: __APP_VERSION__ })}
            </p>
            <Link
              to="/privacy"
              className="inline-flex min-h-12 items-center font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t('privacy.title')}
            </Link>
          </div>
        </section>
      </div>
    </Page>
  )
}
