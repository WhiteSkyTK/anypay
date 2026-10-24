// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import {
  type DeviceKeys,
  exportPublicKey,
  generateDeviceKeys,
  newNonce,
  saleRequestPath,
  signVoucher,
  type TabSummary,
  voucherPath,
} from '@anypay/shared'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { anypayPath } from '@/lib/scan'
import { setMerchantSession } from '@/lib/merchant-session'
import { noteServerDate } from '@/lib/server-clock'
import { setSimulatedOffline } from '@/lib/simulated-offline'
import { flushOutbox, getDb, rememberTab, resetDb, saveTabKeys } from '@/offline'
import { fakeApi, renderPage, SESSION, SHOP, setUpPageTests } from '@/testing/fakes'
import { Component as ApproveSalePage } from './ApproveSalePage'
import { Component as OpenTabPage } from './OpenTabPage'
import { Component as ReceiveVoucherPage } from './ReceiveVoucherPage'
import { Component as ScanPage } from './ScanPage'
import { Component as SettingsPage } from './SettingsPage'
import { Component as TabDetailPage } from './TabDetailPage'
import { Component as TabSalePage } from './TabSalePage'

setUpPageTests()

// No camera in tests (and no Web Worker): the scanner reports itself unavailable, as on a phone
// without one, which is when the paste fallback matters.
vi.mock('qr-scanner', () => ({
  default: class {
    start() {
      return Promise.reject(new Error('No camera'))
    }
    destroy() {}
  },
}))

const TAB_ID = 'tab4fX9qL2pM'
const COP = (value: string) => ({ value, assetCode: 'COP', assetScale: 2 })
const TAB: TabSummary = {
  id: TAB_ID,
  shopId: SHOP.id,
  shopName: SHOP.name,
  label: 'Thabo',
  status: 'active',
  cap: { value: '20000', assetCode: 'ZAR', assetScale: 2 },
  shopCap: COP('3700000'),
  remaining: COP('3700000'),
  weekStartedAt: new Date(Date.now() - 86_400_000).toISOString(),
}

const request = (amount = '2500') => ({
  shopId: SHOP.id,
  amount,
  nonce: newNonce(),
  ts: Math.floor(Date.now() / 1000),
})

beforeEach(async () => {
  await resetDb()
})

async function customerWithTab(): Promise<DeviceKeys> {
  const keys = await generateDeviceKeys()
  await saveTabKeys(TAB_ID, keys)
  await rememberTab(TAB)
  return keys
}

/** The tab as the shop's phone keeps it. */
async function shopTab(keys: DeviceKeys) {
  return {
    id: TAB_ID,
    shopId: SHOP.id,
    label: 'Thabo',
    publicKey: (await exportPublicKey(keys.publicKey)) as never,
    shopCap: COP('3700000'),
    remaining: COP('3700000'),
    weekStartedAt: TAB.weekStartedAt,
    syncedAt: Date.now(),
  }
}

async function shopKnowsTab(keys: DeviceKeys) {
  await getDb().shopTabs.put(await shopTab(keys))
}

describe('opening a tab', () => {
  it('makes a device key, registers its public half and sends the customer to their wallet', async () => {
    const user = userEvent.setup()
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined)
    const calls = fakeApi({
      [`GET /api/shops/${SHOP.id}`]: { body: SHOP },
      'POST /api/wallet-addresses/lookup': {
        body: {
          walletAddress: 'https://ilp.interledger-test.dev/southtest',
          assetCode: 'ZAR',
          assetScale: 2,
        },
      },
      [`POST /api/shops/${SHOP.id}/tabs`]: {
        status: 201,
        body: {
          tab: { ...TAB, status: 'awaiting-consent', shopCap: undefined, remaining: undefined },
          consentUrl: 'https://auth.interledger-test.dev/interact/tab',
        },
      },
    })
    renderPage(OpenTabPage, { pattern: '/shop/:shopId/tab', path: `/shop/${SHOP.id}/tab` })

    await user.type(screen.getByLabelText('Your wallet address'), 'southtest')
    await user.type(screen.getByLabelText('Your name for the shop'), 'Thabo')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(await screen.findByRole('button', { name: /R\s200,00/ }))
    await user.click(screen.getByRole('button', { name: 'Approve in my wallet' }))

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://auth.interledger-test.dev/interact/tab'),
    )
    const open = calls.find((call) => call.path === `/api/shops/${SHOP.id}/tabs`)
    expect(open?.body).toMatchObject({
      customerWallet: '$ilp.interledger-test.dev/southtest',
      weeklyCap: '200',
      label: 'Thabo',
      publicKey: { kty: 'EC', crv: 'P-256' },
    })
    const stored = await getDb().keys.get(TAB_ID)
    expect(stored?.privateKey.extractable).toBe(false)
  })
})

describe('approving a sale (customer, offline)', () => {
  it('signs the shop’s request and shows the voucher QR, with no signal', async () => {
    setSimulatedOffline(true)
    await customerWithTab()
    const sale = request()
    renderPage(ApproveSalePage, {
      pattern: '/t/:shopId/:amount/:nonce/:ts',
      path: saleRequestPath(sale),
    })

    expect(await screen.findByText(`${SHOP.name} asks for`)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(await screen.findByRole('heading', { name: 'Show this to the shop' })).toBeTruthy()
    expect(await getDb().outbox.get(sale.nonce)).toMatchObject({ role: 'customer', state: 'saved' })
  })

  it('explains when this phone has no tab at the shop', async () => {
    setSimulatedOffline(true)
    renderPage(ApproveSalePage, {
      pattern: '/t/:shopId/:amount/:nonce/:ts',
      path: saleRequestPath(request()),
    })
    expect((await screen.findByRole('alert')).textContent).toContain(
      "You don't have a tab at this shop",
    )
  })

  it('refuses an old request', async () => {
    const old = { ...request(), ts: Math.floor(Date.now() / 1000) - 73 * 3600 }
    renderPage(ApproveSalePage, {
      pattern: '/t/:shopId/:amount/:nonce/:ts',
      path: saleRequestPath(old),
    })
    expect((await screen.findByRole('alert')).textContent).toContain('too old')
  })
})

describe('receiving a voucher (shop, offline)', () => {
  it('checks it on the phone and keeps it: Saved – settles when online', async () => {
    setSimulatedOffline(true)
    setMerchantSession(SESSION)
    const keys = await generateDeviceKeys()
    await shopKnowsTab(keys)
    const voucher = await signVoucher(keys.privateKey, { ...request(), tabId: TAB_ID })
    renderPage(ReceiveVoucherPage, {
      pattern: '/v/:tabId/:shopId/:amount/:nonce/:ts/:signature',
      path: voucherPath(voucher),
    })
    expect(await screen.findByText("From Thabo's tab")).toBeTruthy()
    expect(await screen.findByText('Saved – settles when online')).toBeTruthy()
    expect(await getDb().outbox.get(voucher.nonce)).toMatchObject({
      role: 'merchant',
      state: 'saved',
    })
  })

  it('refuses a voucher whose amount was changed', async () => {
    setSimulatedOffline(true)
    setMerchantSession(SESSION)
    const keys = await generateDeviceKeys()
    await shopKnowsTab(keys)
    const voucher = await signVoucher(keys.privateKey, { ...request(), tabId: TAB_ID })
    renderPage(ReceiveVoucherPage, {
      pattern: '/v/:tabId/:shopId/:amount/:nonce/:ts/:signature',
      path: voucherPath({ ...voucher, amount: '999999' }),
    })
    expect((await screen.findByRole('alert')).textContent).toContain(
      "wasn't signed by the customer's phone",
    )
    expect(await getDb().outbox.count()).toBe(0)
  })

  it('says the sale was not saved when the phone is out of space', async () => {
    setSimulatedOffline(true)
    setMerchantSession(SESSION)
    const keys = await generateDeviceKeys()
    await shopKnowsTab(keys)
    vi.spyOn(getDb().outbox, 'put').mockRejectedValue(outOfSpace())
    const voucher = await signVoucher(keys.privateKey, { ...request(), tabId: TAB_ID })
    renderPage(ReceiveVoucherPage, {
      pattern: '/v/:tabId/:shopId/:amount/:nonce/:ts/:signature',
      path: voucherPath(voucher),
    })
    expect((await screen.findByRole('alert')).textContent).toContain("the sale wasn't saved")
    expect(screen.queryByText('Saved – settles when online')).toBeNull()
  })
})

describe('the weekly limit, made clear', () => {
  const approvePage = (sale = request()) =>
    renderPage(ApproveSalePage, {
      pattern: '/t/:shopId/:amount/:nonce/:ts',
      path: saleRequestPath(sale),
    })

  it('shows roughly what leaves the customer’s wallet, in their own currency', async () => {
    setSimulatedOffline(true)
    await customerWithTab()
    approvePage(request('370000')) // COP 3 700,00 = 1/10 of the COP 37 000 limit (R200)
    expect(await screen.findByText(/About R\s20,00 from your wallet/)).toBeTruthy()
  })

  it('refuses a sale over what is left before the tap, with when it resets and what to do', async () => {
    setSimulatedOffline(true)
    await customerWithTab()
    await rememberTab({ ...TAB, remaining: COP('1000') })
    approvePage(request('2500'))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain("This is more than what's left on your tab this week.")
    expect(alert.textContent).toMatch(/starts again on/)
    expect(screen.getByRole('link', { name: /higher limit/ }).getAttribute('href')).toBe(
      `/shop/${SHOP.id}/tab`,
    )
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveProperty('disabled', true)
  })

  it('sells on the tab with room when an older tab at the shop is used up', async () => {
    setSimulatedOffline(true)
    await customerWithTab() // the old tab
    await rememberTab({ ...TAB, remaining: COP('0') })
    const newKeys = await generateDeviceKeys()
    await saveTabKeys('tabNewOne123', newKeys)
    await rememberTab({ ...TAB, id: 'tabNewOne123' })
    approvePage()
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await screen.findByRole('heading', { name: 'Show this to the shop' })
    expect((await getDb().outbox.toArray())[0]?.tabId).toBe('tabNewOne123')
  })

  it('explains a used-up week on the tab, in both currencies, with a way to a higher limit', async () => {
    setSimulatedOffline(true)
    await customerWithTab()
    await rememberTab({ ...TAB, remaining: COP('0') })
    renderPage(TabDetailPage, { pattern: '/tab/:tabId', path: `/tab/${TAB_ID}` })
    expect(await screen.findByText(/This week's limit is used up/)).toBeTruthy()
    expect(screen.getByText(/about COP\s37\s000,00 at/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /higher limit/ })).toBeTruthy()
  })
})

describe('the whole journey, on two phones', () => {
  it('opens a tab online, sells with both phones offline, and settles once when back', async () => {
    // Customer's phone, once, with signal: the tab is open and approved in the wallet.
    const keys = await customerWithTab()
    setSimulatedOffline(true)

    // The shop's phone made a sale request; the customer approves it with no signal.
    const sale = request('2500')
    renderPage(ApproveSalePage, {
      pattern: '/t/:shopId/:amount/:nonce/:ts',
      path: saleRequestPath(sale),
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await screen.findByRole('heading', { name: 'Show this to the shop' })
    const signed = await getDb().outbox.get(sale.nonce)
    if (!signed) throw new Error('no voucher was signed')
    cleanup() // the customer's phone is done

    // The shop's phone (its own storage) scans the customer's QR, still with no signal.
    await resetDb()
    setMerchantSession(SESSION)
    await shopKnowsTab(keys)
    renderPage(ReceiveVoucherPage, {
      pattern: '/v/:tabId/:shopId/:amount/:nonce/:ts/:signature',
      path: voucherPath({ ...sale, tabId: TAB_ID, signature: signed.signature }),
    })
    expect(await screen.findByText('Saved – settles when online')).toBeTruthy()

    // Signal returns: the voucher goes to the server once and both sides see it settled.
    const calls = fakeApi({
      [`POST /api/tabs/${TAB_ID}/vouchers`]: {
        body: {
          nonce: sale.nonce,
          tabId: TAB_ID,
          amount: COP('2500'),
          status: 'settled',
          paymentId: '70125f46-5c8b-48f5-afea-0b345a6468ad',
        },
      },
    })
    setSimulatedOffline(false)
    await flushOutbox()
    expect(await getDb().outbox.get(sale.nonce)).toMatchObject({ state: 'settled' })
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1)
  })
})

describe('when the phone can’t keep tabs', () => {
  it('explains, on a plain http:// address, why tabs can’t work here', async () => {
    vi.stubGlobal('isSecureContext', false) // e.g. a laptop's IP on the shop's Wi-Fi
    renderPage(OpenTabPage, { pattern: '/shop/:shopId/tab', path: `/shop/${SHOP.id}/tab` })
    expect(
      await screen.findByRole('heading', { level: 1, name: "Offline tabs can't work here" }),
    ).toBeTruthy()
    expect(screen.getByText(/need a secure connection/)).toBeTruthy()
  })

  it('tells the customer an approval wasn’t saved, instead of a button that does nothing', async () => {
    setSimulatedOffline(true)
    await customerWithTab()
    vi.spyOn(getDb().outbox, 'put').mockRejectedValue(outOfSpace())
    renderPage(ApproveSalePage, {
      pattern: '/t/:shopId/:amount/:nonce/:ts',
      path: saleRequestPath(request()),
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    expect((await screen.findByRole('alert')).textContent).toContain('out of storage space')
  })
})

describe('a phone with the wrong clock', () => {
  afterEach(() => noteServerDate(new Date().toUTCString(), Date.now(), Date.now()))

  it('stamps the sale with the server’s time and asks for the clock to be fixed', async () => {
    setMerchantSession(SESSION)
    const keys = await generateDeviceKeys()
    fakeApi({
      [`GET /api/shops/${SHOP.id}/tabs`]: {
        body: { tabs: [{ ...(await shopTab(keys)), syncedAt: undefined, shopId: undefined }] },
      },
    })
    // The last answer from the server said it is two hours later than this phone thinks.
    const now = Date.now()
    noteServerDate(new Date(now + 2 * HOUR).toUTCString(), now, now)
    // The same copy of the QR library the page loads (lazily), to read the link it encodes.
    const qrCreate = vi.spyOn((await import('qrcode')).default, 'create')
    renderPage(TabSalePage, { pattern: '/merchant/tab-sale', path: '/merchant/tab-sale' })

    expect(await screen.findByText(/clock is about 120 minutes off/)).toBeTruthy()
    expect(await screen.findByText('Customer tabs on this phone: 1')).toBeTruthy()
    const keypad = screen.getByRole('group', { name: 'Amount keypad' })
    await userEvent.click(keypad.querySelector('button[aria-label="5"]') as HTMLElement)
    await userEvent.click(screen.getByRole('button', { name: 'Show QR to customer' }))
    await screen.findByRole('img', { name: /Tab sale QR code/ })
    const ts = Number(String(qrCreate.mock.calls.at(-1)?.[0]).split('/').at(-1))
    // Stamped in the server's time (two hours on), so the server won't refuse the voucher.
    expect(Math.abs(ts * 1000 - (now + 2 * HOUR))).toBeLessThan(60_000)
  })
})

const HOUR = 3_600_000

const outOfSpace = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError')

describe('tab sale (shop)', () => {
  it('downloads the shop’s tabs, then shows a QR for the typed amount', async () => {
    setMerchantSession(SESSION)
    const keys = await generateDeviceKeys()
    fakeApi({
      [`GET /api/shops/${SHOP.id}/tabs`]: {
        body: {
          tabs: [
            {
              id: TAB_ID,
              label: 'Thabo',
              publicKey: await exportPublicKey(keys.publicKey),
              shopCap: COP('3700000'),
              remaining: COP('3700000'),
              weekStartedAt: TAB.weekStartedAt,
            },
          ],
        },
      },
    })
    renderPage(TabSalePage, { pattern: '/merchant/tab-sale', path: '/merchant/tab-sale' })
    expect(await screen.findByText('Customer tabs on this phone: 1')).toBeTruthy()
    const keypad = screen.getByRole('group', { name: 'Amount keypad' })
    await userEvent.click(keypad.querySelector('button[aria-label="2"]') as HTMLElement)
    await userEvent.click(keypad.querySelector('button[aria-label="5"]') as HTMLElement)
    await userEvent.click(screen.getByRole('button', { name: 'Show QR to customer' }))
    expect(await screen.findByRole('img', { name: /Tab sale QR code for COP\s25,00/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: "Scan the customer's QR" }).getAttribute('href')).toBe(
      '/scan',
    )
  })

  it('says so when no customer has a tab yet', async () => {
    setMerchantSession(SESSION)
    fakeApi({ [`GET /api/shops/${SHOP.id}/tabs`]: { body: { tabs: [] } } })
    renderPage(TabSalePage, { pattern: '/merchant/tab-sale', path: '/merchant/tab-sale' })
    expect(await screen.findByText('No tabs yet')).toBeTruthy()
  })
})

describe('scanning', () => {
  it('opens only AnyPay links, whatever site printed them', () => {
    expect(anypayPath('https://anypay-web.onrender.com/s/7KQM4XPA')).toBe('/s/7KQM4XPA')
    expect(anypayPath(`https://x.example${saleRequestPath(request())}`)).toMatch(/^\/t\//)
    expect(anypayPath('https://evil.example/login')).toBeNull()
    expect(anypayPath('javascript:alert(1)')).toBeNull()
  })

  it('opens a pasted link when the camera isn’t available', async () => {
    renderPage(ScanPage, { pattern: '/scan', path: '/scan', stubs: ['/s/:code'] })
    await userEvent.type(
      screen.getByLabelText('Or paste the link'),
      'https://anypay-web.onrender.com/s/7KQM4XPA',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByText('Stub page /s/:code')).toBeTruthy()
  })

  it('says when a code isn’t AnyPay’s', async () => {
    renderPage(ScanPage, { pattern: '/scan', path: '/scan' })
    await userEvent.type(screen.getByLabelText('Or paste the link'), 'https://example.org/hello')
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect((await screen.findByRole('alert')).textContent).toBe("That isn't an AnyPay code.")
  })
})

describe('Simulate offline (demo)', () => {
  it('can be switched on in demo mode, and then no request leaves the phone', async () => {
    const calls = fakeApi({ 'GET /api/config': { body: { demoMode: true, version: '0.1.0' } } })
    renderPage(SettingsPage, { pattern: '/settings', path: '/settings' })
    await userEvent.click(await screen.findByRole('switch', { name: 'Simulate offline (demo)' }))
    const before = calls.length
    const { api } = await import('@/lib/api')
    await expect(api.getTab(TAB_ID)).rejects.toMatchObject({ code: 'network_error' })
    expect(calls).toHaveLength(before)
  })
})
