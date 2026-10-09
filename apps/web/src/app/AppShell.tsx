import { LazyMotion, MotionConfig } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Outlet, ScrollRestoration, useMatches } from 'react-router'
import { DemoBanner } from '@/components/DemoBanner'
import { OfflineBanner } from '@/components/OfflineBanner'
import { TabBar } from '@/components/TabBar'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { useRouteFocus } from '@/hooks/useRouteFocus'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import type { RouteHandle } from './route-handle'

// The animation engine loads after first paint; until then `m` components render without motion.
const loadMotionFeatures = () => import('@/lib/motion-features').then((module) => module.default)

export function AppShell() {
  const { t } = useTranslation()
  const matches = useMatches()
  // Onboarding and the pay flow are focused, single-task screens, so they hide the tab bar.
  const showTabBar = matches.some((match) => (match.handle as RouteHandle | undefined)?.tabBar)

  useTheme()
  useRouteFocus()

  return (
    // reducedMotion="user": springs become instant when the phone asks for less motion.
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          {t('app.skipToContent')}
        </a>
        <DemoBanner />
        <div className="print:hidden">
          <OfflineBanner />
        </div>
        <main id="main" tabIndex={-1} className={cn('focus:outline-none', showTabBar && 'pb-36')}>
          <Outlet />
        </main>
        <div className="print:hidden">
          {showTabBar && <TabBar />}
          <UpdatePrompt />
        </div>
        <ScrollRestoration />
      </LazyMotion>
    </MotionConfig>
  )
}
