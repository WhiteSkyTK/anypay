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
      // Customer screens: reached from a QR code, so no tab bar to distract from paying.
      { path: 'shop/:shopId/pay', lazy: () => import('@/pages/PayPage') },
      { path: 'receipt/:paymentId', lazy: () => import('@/pages/ReceiptPage') },
      // Merchant screens.
      { path: 'merchant', handle: withTabBar, lazy: () => import('@/pages/MerchantPage') },
      { path: 'merchant/new', lazy: () => import('@/pages/MerchantSetupPage') },
      { path: 'merchant/poster', lazy: () => import('@/pages/PosterPage') },
      { path: 'merchant/connect', lazy: () => import('@/pages/MerchantConnectPage') },
      { path: 'tab', handle: withTabBar, lazy: () => import('@/pages/TabPage') },
      { path: 'settings', handle: withTabBar, lazy: () => import('@/pages/SettingsPage') },
      { path: '*', lazy: () => import('@/pages/NotFoundPage') },
    ],
  },
])
