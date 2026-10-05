import { useTranslation } from 'react-i18next'
import { Outlet, ScrollRestoration, useMatches } from 'react-router'
import { OfflineBanner } from '@/components/OfflineBanner'
import { TabBar } from '@/components/TabBar'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { useRouteFocus } from '@/hooks/useRouteFocus'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import type { RouteHandle } from './route-handle'

export function AppShell() {
  const { t } = useTranslation()
  const matches = useMatches()
  // Onboarding and the pay flow are focused, single-task screens, so they hide the tab bar.
  const showTabBar = matches.some((match) => (match.handle as RouteHandle | undefined)?.tabBar)

  useTheme()
  useRouteFocus()

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        {t('app.skipToContent')}
      </a>
      <OfflineBanner />
      <main id="main" tabIndex={-1} className={cn('focus:outline-none', showTabBar && 'pb-36')}>
        <Outlet />
      </main>
      {showTabBar && <TabBar />}
      <UpdatePrompt />
      <ScrollRestoration />
    </>
  )
}
