// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getMerchantSession, setMerchantSession } from '@/lib/merchant-session'
import { apiError, fakeApi, renderPage, SESSION, SHOP, setUpPageTests } from '@/testing/fakes'
import { Component as MerchantConnectPage } from './MerchantConnectPage'
import { Component as MerchantSetupPage } from './MerchantSetupPage'
import { Component as PosterPage } from './PosterPage'

setUpPageTests()

const LOOKUP = {
  body: {
    walletAddress: SHOP.walletAddress,
    publicName: 'merchant',
    assetCode: 'COP',
    assetScale: 2,
  },
}

const openSetup = () =>
  renderPage(MerchantSetupPage, {
    pattern: '/merchant/new',
    path: '/merchant/new',
    stubs: ['/merchant/poster'],
  })

async function checkWallet(user: ReturnType<typeof userEvent.setup>, wallet: string) {
  await user.type(screen.getByLabelText('Your wallet address'), wallet)
  await user.click(screen.getByRole('button', { name: 'Check wallet' }))
}

describe('MerchantSetupPage', () => {
  it('checks the wallet, names the shop and saves it on this phone', async () => {
    const user = userEvent.setup()
    const calls = fakeApi({
      'POST /api/wallet-addresses/lookup': LOOKUP,
      'POST /api/shops': { status: 201, body: { shop: SHOP, merchantToken: 'merchant-token' } },
    })
    openSetup()
    expect(screen.getByText('Step 1 of 2')).toBeTruthy()

    await checkWallet(user, '$ilp.interledger-test.dev/merchanttest')
    expect(await screen.findByText('Payments arrive in COP')).toBeTruthy()
    const name = screen.getByLabelText('Shop name')
    expect(name).toHaveProperty('value', 'merchant')

    await user.clear(name)
    await user.type(name, SHOP.name)
    await user.click(screen.getByRole('button', { name: 'Create my shop' }))

    expect(await screen.findByText('Stub page /merchant/poster')).toBeTruthy()
    expect(getMerchantSession()).toEqual(SESSION)
    const create = calls.find((call) => call.path === '/api/shops')
    expect(create?.body).toEqual({ name: SHOP.name, walletAddress: SHOP.walletAddress })
    expect(create?.headers['Idempotency-Key']).toBeTruthy()
  })

  it('catches a mistyped address before asking the server', async () => {
    const user = userEvent.setup()
    const calls = fakeApi({})
    openSetup()
    await checkWallet(user, 'hello')
    expect(screen.getByText('Wallet addresses start with $ or https://')).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it('explains a wallet that does not exist, and lets the shop change the wallet later', async () => {
    const user = userEvent.setup()
    fakeApi({
      'POST /api/wallet-addresses/lookup': [apiError(404, 'wallet_not_found'), LOOKUP],
    })
    openSetup()
    await checkWallet(user, '$ilp.interledger-test.dev/nobody')
    expect(await screen.findByText("There's no wallet at that address.")).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Check wallet' }))
    await user.click(await screen.findByRole('button', { name: 'Change' }))
    expect(screen.getByRole('button', { name: 'Check wallet' })).toBeTruthy()
  })

  it('retries a failed create with the same Idempotency-Key, so only one shop is made', async () => {
    const user = userEvent.setup()
    const calls = fakeApi({
      'POST /api/wallet-addresses/lookup': LOOKUP,
      'POST /api/shops': [
        { networkError: true },
        { status: 201, body: { shop: SHOP, merchantToken: 'merchant-token' } },
      ],
    })
    openSetup()
    await checkWallet(user, '$ilp.interledger-test.dev/merchanttest')
    await user.click(await screen.findByRole('button', { name: 'Create my shop' }))
    expect(await screen.findByText(/No connection/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Create my shop' }))
    await screen.findByText('Stub page /merchant/poster')

    const keys = calls
      .filter((call) => call.path === '/api/shops')
      .map((call) => call.headers['Idempotency-Key'])
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
  })

  it('rejects a one-letter shop name', async () => {
    const user = userEvent.setup()
    fakeApi({ 'POST /api/wallet-addresses/lookup': LOOKUP })
    openSetup()
    await checkWallet(user, '$ilp.interledger-test.dev/merchanttest')
    const name = await screen.findByLabelText('Shop name')
    await user.clear(name)
    await user.type(name, 'K')
    await user.click(screen.getByRole('button', { name: 'Create my shop' }))
    expect(screen.getByText('Use at least 2 letters')).toBeTruthy()
  })
})

describe('MerchantConnectPage', () => {
  const openLink = (hash: string) => {
    window.location.hash = hash
    renderPage(MerchantConnectPage, {
      pattern: '/merchant/connect',
      path: '/merchant/connect',
      stubs: ['/merchant', '/merchant/new'],
    })
  }

  it('signs the phone in when the shop accepts the token', async () => {
    fakeApi({
      [`GET /api/shops/${SHOP.id}`]: { body: SHOP },
      [`GET /api/shops/${SHOP.id}/payments`]: {
        body: { payments: [], total: { value: '0', assetCode: 'COP', assetScale: 2 } },
      },
    })
    openLink(`#shop=${SHOP.id}&token=merchant-token`)
    expect(await screen.findByText('Stub page /merchant')).toBeTruthy()
    expect(getMerchantSession()).toEqual(SESSION)
    expect(window.location.hash).toBe('')
  })

  it('refuses a link with a wrong token', async () => {
    fakeApi({
      [`GET /api/shops/${SHOP.id}`]: { body: SHOP },
      [`GET /api/shops/${SHOP.id}/payments`]: apiError(401, 'merchant_unauthorized'),
    })
    openLink(`#shop=${SHOP.id}&token=wrong`)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(getMerchantSession()).toBeNull()
  })

  it('refuses a link without a token', () => {
    openLink('')
    expect(screen.getByRole('alert').textContent).toContain("This link didn't work.")
  })
})

describe('PosterPage', () => {
  it('shows the shop’s QR code and prints it', async () => {
    setMerchantSession(SESSION)
    const print = vi.fn()
    vi.stubGlobal('print', print)
    renderPage(PosterPage, { pattern: '/merchant/poster', path: '/merchant/poster' })

    expect(await screen.findByRole('img', { name: `QR code to pay ${SHOP.name}` })).toBeTruthy()
    expect(document.body.textContent).toContain(`/shop/${SHOP.id}/pay`)
    await userEvent.click(screen.getByRole('button', { name: 'Print poster' }))
    expect(print).toHaveBeenCalledOnce()
  })

  it('sends a phone without a shop to set-up', async () => {
    renderPage(PosterPage, {
      pattern: '/merchant/poster',
      path: '/merchant/poster',
      stubs: ['/merchant/new'],
    })
    expect(await screen.findByText('Stub page /merchant/new')).toBeTruthy()
  })
})
