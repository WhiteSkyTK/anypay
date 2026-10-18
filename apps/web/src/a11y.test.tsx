// @vitest-environment happy-dom
// Automated accessibility checks (axe-core, the engine behind Lighthouse's accessibility audit) on
// every screen, rendered inside <main> as in the app. Colour contrast needs real layout, so it is
// checked separately: tokens.test.ts verifies every text/background pair in both themes.
import 'fake-indexeddb/auto'
import { exportPublicKey, generateDeviceKeys, newNonce, saleRequestPath } from '@anypay/shared'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import type { ComponentType } from 'react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setMerchantSession } from '@/lib/merchant-session'
import { setSimulatedOffline } from '@/lib/simulated-offline'
import { getDb, rememberTab, resetDb, saveTabKeys } from '@/offline'
import { FakeEventSource, fakeApi, payment, SESSION, SHOP, setUpPageTests } from '@/testing/fakes'
import { Component as ApproveSalePage } from './pages/ApproveSalePage'
import { Component as CustomerPage } from './pages/CustomerPage'
import { Component as MerchantPage } from './pages/MerchantPage'
import { Component as MerchantSetupPage } from './pages/MerchantSetupPage'
import { Component as NotFoundPage } from './pages/NotFoundPage'
import { Component as OnboardingPage } from './pages/OnboardingPage'
import { Component as OpenTabPage } from './pages/OpenTabPage'
import { Component as PayPage } from './pages/PayPage'
import { Component as PosterPage } from './pages/PosterPage'
import { Component as PrivacyPage } from './pages/PrivacyPage'
import { Component as ReceiptPage } from './pages/ReceiptPage'
import { Component as ScanPage } from './pages/ScanPage'
import { Component as SettingsPage } from './pages/SettingsPage'
import { Component as ShopPhonesPage } from './pages/ShopPhonesPage'
import { Component as TabPage } from './pages/TabPage'
import { Component as TabSalePage } from './pages/TabSalePage'

setUpPageTests()

vi.mock('qr-scanner', () => ({
  default: class {
    start() {
      return Promise.reject(new Error('No camera'))
    }
    destroy() {}
  },
}))

beforeEach(async () => {
  document.documentElement.lang = 'en'
  await resetDb()
})

function renderScreen(Page: ComponentType, pattern: string, path: string) {
  const router = createMemoryRouter(
    [
      {
        element: (
          <main id="main">
            <Outlet />
          </main>
        ),
        children: [{ path: pattern, Component: Page }],
      },
    ],
    { initialEntries: [path] },
  )
  return render(<RouterProvider router={router} />)
}

/** Fails with a readable list of every axe violation on the page. */
async function expectAccessible(extraRulesOff: string[] = []) {
  const rules = Object.fromEntries(
    ['color-contrast', ...extraRulesOff].map((rule) => [rule, { enabled: false }]),
  )
  const results = await axe.run(document.body, { rules })
  const problems = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`,
  )
  expect(problems).toEqual([])
}

const COP = (value: string) => ({ value, assetCode: 'COP', assetScale: 2 })

describe('accessibility (axe)', () => {
  it('start page', async () => {
    renderScreen(OnboardingPage, '/', '/')
    await screen.findByRole('heading', { level: 1 })
    await expectAccessible()
  })

  it('Pay a shop', async () => {
    renderScreen(CustomerPage, '/pay', '/pay')
    await screen.findByRole('heading', { level: 1 })
    await expectAccessible()
  })

  it('pay screen, and its price sheet', async () => {
    fakeApi({
      [`GET /api/shops/${SHOP.id}`]: { body: SHOP },
      [`POST /api/shops/${SHOP.id}/payments`]: {
        status: 201,
        body: {
          payment: payment(),
          quote: {
            debitAmount: { value: '27', assetCode: 'ZAR', assetScale: 2 },
            receiveAmount: COP('5000'),
          },
          consentUrl: 'https://auth.interledger-test.dev/interact/x',
        },
      },
    })
    renderScreen(PayPage, '/shop/:shopId/pay', `/shop/${SHOP.id}/pay`)
    await screen.findByRole('heading', { level: 1, name: SHOP.name })
    await expectAccessible()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.type(screen.getByLabelText('Your wallet address'), 'southtest')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('dialog', { name: 'Confirm payment' })
    // While the sheet is open, Radix hides the page behind it from screen readers and traps focus
    // in the sheet (its focus guards are what keep focus there), so the hidden page's buttons can't
    // be reached; axe still counts them. Everything else is checked.
    await expectAccessible(['aria-hidden-focus'])
  })

  it('receipt', async () => {
    renderScreen(ReceiptPage, '/receipt/:paymentId', `/receipt/${payment().id}`)
    const source = FakeEventSource.latest()
    act(() => source.open())
    act(() =>
      source.emit(
        'payment',
        payment({ status: 'completed', completedAt: new Date().toISOString() }),
      ),
    )
    await screen.findByRole('heading', { name: 'Paid' })
    await expectAccessible()
  })

  it('shop set-up', async () => {
    renderScreen(MerchantSetupPage, '/merchant/new', '/merchant/new')
    await screen.findByRole('heading', { level: 1 })
    await expectAccessible()
  })

  it('shop feed with payments', async () => {
    setMerchantSession(SESSION)
    renderScreen(MerchantPage, '/merchant', '/merchant')
    const source = await waitFor(() => FakeEventSource.latest()) // once its ticket is back
    act(() => source.open())
    act(() =>
      source.emit('snapshot', {
        payments: [
          payment({
            status: 'completed',
            completedAt: new Date().toISOString(),
            tabId: 'tab4fX9qL2pM',
          }),
        ],
        total: COP('5000'),
      }),
    )
    await screen.findByRole('listitem')
    await expectAccessible()
  })

  it('poster', async () => {
    setMerchantSession(SESSION)
    renderScreen(PosterPage, '/merchant/poster', '/merchant/poster')
    await screen.findByRole('img', { name: `QR code to pay ${SHOP.name}` })
    await expectAccessible()
  })

  it('settings, with Simulate offline', async () => {
    fakeApi({ 'GET /api/config': { body: { demoMode: true, version: '0.1.0' } } })
    renderScreen(SettingsPage, '/settings', '/settings')
    await screen.findByRole('switch', { name: 'Simulate offline (demo)' })
    await expectAccessible()
  })

  it('open a tab', async () => {
    fakeApi({ [`GET /api/shops/${SHOP.id}`]: { body: SHOP } })
    renderScreen(OpenTabPage, '/shop/:shopId/tab', `/shop/${SHOP.id}/tab`)
    await screen.findByLabelText('Your name for the shop')
    await expectAccessible()
  })

  it('my tabs, approve a sale, and tab sale', async () => {
    setSimulatedOffline(true)
    const keys = await generateDeviceKeys()
    await saveTabKeys('tab4fX9qL2pM', keys)
    await rememberTab({
      id: 'tab4fX9qL2pM',
      shopId: SHOP.id,
      shopName: SHOP.name,
      label: 'Thabo',
      status: 'active',
      cap: { value: '20000', assetCode: 'ZAR', assetScale: 2 },
      shopCap: COP('3700000'),
      remaining: COP('3700000'),
      weekStartedAt: new Date().toISOString(),
    })

    const tabs = renderScreen(TabPage, '/tab', '/tab')
    await screen.findByText(SHOP.name)
    await expectAccessible()
    tabs.unmount()

    const sale = {
      shopId: SHOP.id,
      amount: '2500',
      nonce: newNonce(),
      ts: Math.floor(Date.now() / 1000),
    }
    const approve = renderScreen(
      ApproveSalePage,
      '/t/:shopId/:amount/:nonce/:ts',
      saleRequestPath(sale),
    )
    await screen.findByRole('button', { name: 'Approve' })
    await expectAccessible()
    approve.unmount()

    setMerchantSession(SESSION)
    await getDb().shopTabs.put({
      id: 'tab4fX9qL2pM',
      shopId: SHOP.id,
      label: 'Thabo',
      publicKey: (await exportPublicKey(keys.publicKey)) as never,
      shopCap: COP('3700000'),
      remaining: COP('3700000'),
      weekStartedAt: new Date().toISOString(),
      syncedAt: Date.now(),
    })
    renderScreen(TabSalePage, '/merchant/tab-sale', '/merchant/tab-sale')
    await screen.findByRole('group', { name: 'Amount keypad' })
    await expectAccessible()
  })

  it('scanner and page not found', async () => {
    const scan = renderScreen(ScanPage, '/scan', '/scan')
    await screen.findByLabelText('Or paste the link')
    await expectAccessible()
    scan.unmount()
    renderScreen(NotFoundPage, '*', '/nowhere')
    await screen.findByRole('heading', { level: 1 })
    await expectAccessible()
  })

  it('your shop on other phones, with the sign-in code', async () => {
    setMerchantSession(SESSION)
    renderScreen(ShopPhonesPage, '/merchant/phones', '/merchant/phones')
    await userEvent.click(screen.getByRole('button', { name: 'Show sign-in code' }))
    await screen.findByRole('img', { name: `Sign-in code for ${SHOP.name}` })
    await expectAccessible()
  })

  it('privacy notice', async () => {
    renderScreen(PrivacyPage, '/privacy', '/privacy')
    await screen.findByRole('heading', { level: 1, name: 'Privacy' })
    await expectAccessible()
  })
})
