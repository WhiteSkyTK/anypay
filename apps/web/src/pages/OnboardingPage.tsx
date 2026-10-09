import { ArrowRight, QrCode, Wallet, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { HeroIllustration } from '@/components/HeroIllustration'
import { LanguageSelect } from '@/components/LanguageSelect'
import { LogoMark } from '@/components/LogoMark'
import { DocumentTitle } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { useDarkChrome } from '@/hooks/useDarkChrome'

const FEATURES = [
  { key: 'onboarding.features.qr', Icon: QrCode },
  { key: 'onboarding.features.anyWallet', Icon: Wallet },
  { key: 'onboarding.features.offline', Icon: WifiOff },
] as const

/**
 * Bold monochrome welcome (onboarding-mono reference). The `dark` class gives this subtree the
 * dark tokens in either theme. Phone: header, illustration filling the middle, text and actions
 * in the thumb zone. Desktop: the same content in two columns on one aligned grid.
 */
export function Component() {
  const { t } = useTranslation()
  useDarkChrome()

  return (
    // Exactly one screen tall (h-dvh), so the illustration can measure the space that's left.
    // If the text alone is taller than the screen (tiny phone, long language), this screen scrolls.
    <div className="dark flex h-dvh flex-col overflow-y-auto bg-background text-foreground">
      <DocumentTitle title={t('onboarding.documentTitle')} />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="flex items-center gap-2.5 text-lg font-bold tracking-title">
          <LogoMark className="size-8 shrink-0" />
          {t('app.name')}
        </p>
        <LanguageSelect hideLabel className="w-40" />
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-5xl flex-1 grid-rows-[minmax(0,1fr)_auto] gap-6 px-6 lg:grid-cols-[3fr_2fr] lg:grid-rows-1 lg:items-center lg:gap-12">
        {/* The illustration takes only the space left over, so longer translations and short
            phones never push the actions below the fold. */}
        <div className="flex min-h-0 items-center justify-center pt-4 lg:order-last">
          <HeroIllustration className="h-full max-h-56 w-auto max-w-full lg:h-auto lg:max-h-none lg:w-full lg:max-w-sm" />
        </div>

        <div className="self-end pb-[max(2rem,env(safe-area-inset-bottom))] lg:self-center">
          <h1
            tabIndex={-1}
            className="text-hero font-bold tracking-title text-balance focus:outline-none"
          >
            {t('onboarding.headlineLine1')}
            <br />
            {t('onboarding.headlineLine2')}
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">{t('onboarding.body')}</p>

          <ul className="mt-6 flex flex-wrap gap-2">
            {FEATURES.map(({ key, Icon }) => (
              <li
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
              >
                <Icon aria-hidden="true" className="size-4" />
                {t(key)}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="inverse">
              <Link to="/merchant/new">
                {t('onboarding.setUpShop')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/tab">{t('onboarding.imCustomer')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
