import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, ScrollRestoration, useMatches } from 'react-router'
import { DemoBanner } from '@/components/DemoBanner'
import { OfflineBanner } from '@/components/OfflineBanner'
import { SlowNotice } from '@/components/SlowNotice'
import { TabBar } from '@/components/TabBar'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { useRouteFocus } from '@/hooks/useRouteFocus'
import { useTheme } from '@/hooks/useTheme'
import { loadOffline, usesOfflineTabs } from '@/lib/offline-flag'
import { cn } from '@/lib/utils'
import type { RouteHandle } from './route-handle'
import { useHideSplash } from './useHideSplash'

export function AppShell() {
  const { t } = useTranslation()
  const matches = useMatches()
  // Onboarding and the pay flow are focused, single-task screens, so they hide the tab bar.
  const showTabBar = matches.some((match) => (match.handle as RouteHandle | undefined)?.tabBar)

  useHideSplash()
  useTheme()
  useRouteFocus()

  // Phones that use tabs keep their vouchers moving in the background from the moment the app
  // opens; everyone else never downloads the offline store.
  useEffect(() => {
    if (usesOfflineTabs()) void loadOffline().then((offline) => offline.startOfflineSync())
  }, [])

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        {t('app.skipToContent')}
      </a>
      <DemoBanner />
      <div className="print:hidden">
        <OfflineBanner />
        <SlowNotice />
      </div>
      <main id="main" tabIndex={-1} className={cn('focus:outline-none', showTabBar && 'pb-36')}>
        <Outlet />
      </main>
      <div className="print:hidden">
        {showTabBar && <TabBar />}
        <UpdatePrompt />
      </div>
      <ScrollRestoration />
    </>
  )
}
