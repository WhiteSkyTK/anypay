import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DocumentTitle } from '@/components/Page'
import { Button } from '@/components/ui/button'

/** Thin hand-drawn curves from the monochrome onboarding reference. Pure decoration. */
function BackdropLines() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 -z-10 size-full text-muted-foreground/25"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M-40 140C120 40 260 260 440 120" />
      <path d="M-60 420C80 300 300 520 460 360" />
      <path d="M40 -20C10 200 330 300 300 820" />
    </svg>
  )
}

/**
 * Bold monochrome welcome (onboarding-mono reference). The `dark` class gives this subtree the
 * dark tokens in either theme, so it is always white-on-near-black with checked contrast.
 */
export function Component() {
  const { t } = useTranslation()
  return (
    <div className="dark relative isolate flex min-h-dvh flex-col overflow-hidden bg-background px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-foreground">
      <DocumentTitle title={t('onboarding.documentTitle')} />
      <BackdropLines />
      <p className="text-lg font-bold tracking-title">{t('app.name')}</p>

      <div className="mx-auto mt-auto w-full max-w-xl">
        <h1 tabIndex={-1} className="text-hero font-bold tracking-title focus:outline-none">
          {t('onboarding.headlineLine1')}
          <br />
          {t('onboarding.headlineLine2')}
        </h1>
        <p className="mt-5 max-w-md text-lg text-muted-foreground">{t('onboarding.body')}</p>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" variant="inverse">
            <Link to="/merchant">
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
  )
}
