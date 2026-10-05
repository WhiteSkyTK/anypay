import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/app/AppShell'
import { RouteError } from '@/app/RouteError'
import { withTabBar } from '@/app/route-handle'

// Every page is its own lazy chunk: the first visit downloads only the screen it shows, and
// the service worker precaches the rest for offline use.
export const router = createBrowserRouter([
  {
    Component: AppShell,
    ErrorBoundary: RouteError,
    // Shown for the split second while the first page's chunk loads; the background is already painted.
    HydrateFallback: () => <div aria-busy="true" className="min-h-dvh" />,
    children: [
      { index: true, lazy: () => import('@/pages/OnboardingPage') },
      { path: 'shop/:shopId/pay', lazy: () => import('@/pages/PayPage') },
      { path: 'merchant', handle: withTabBar, lazy: () => import('@/pages/MerchantPage') },
      { path: 'tab', handle: withTabBar, lazy: () => import('@/pages/TabPage') },
      { path: 'settings', handle: withTabBar, lazy: () => import('@/pages/SettingsPage') },
      { path: '*', lazy: () => import('@/pages/NotFoundPage') },
    ],
  },
])
