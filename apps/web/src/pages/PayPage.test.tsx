// @vitest-environment happy-dom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { apiError, fakeApi, payment, renderPage, SHOP, setUpPageTests } from '@/testing/fakes'
import { Component as PayPage } from './PayPage'

setUpPageTests()

const CONSENT_URL = 'https://auth.interledger-test.dev/interact/abc'
const QUOTED = {
  status: 201,
  body: {
    payment: payment({ status: 'awaiting-consent' }),
    quote: {
      debitAmount: { value: '27', assetCode: 'ZAR', assetScale: 2 },
      receiveAmount: { value: '5000', assetCode: 'COP', assetScale: 2 },
      expiresAt: '2026-10-09T19:57:00.000Z',
    },
    consentUrl: CONSENT_URL,
  },
}

const openPayPage = () =>
  renderPage(PayPage, { pattern: '/shop/:shopId/pay', path: `/shop/${SHOP.id}/pay` })

async function enterPayment(
  user: ReturnType<typeof userEvent.setup>,
  wallet = '$ilp.interledger-test.dev/southtest',
) {
  const keypad = await screen.findByRole('group', { name: 'Amount keypad' })
  await user.click(within(keypad).getByRole('button', { name: '5' }))
  await user.click(within(keypad).getByRole('button', { name: '0' }))
  await user.type(screen.getByLabelText('Your wallet address'), wallet)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
}

describe('PayPage', () => {
  it('quotes the exact price, then sends the customer to their own wallet', async () => {
    const user = userEvent.setup()
    const calls = fakeApi({
      [`GET /api/shops/${SHOP.id}`]: { body: SHOP },
      [`POST /api/shops/${SHOP.id}/payments`]: QUOTED,
    })
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined)
    openPayPage()

    expect(await screen.findByRole('heading', { level: 1, name: SHOP.name })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', true)
    await enterPayment(user)

    const sheet = await screen.findByRole('dialog', { name: 'Confirm payment' })
    expect(sheet.textContent).toMatch(/You pay\s*R\s0,27/)
    const post = calls.find((call) => call.method === 'POST')
    expect(post?.body).toEqual({
      amount: '50',
      customerWallet: '$ilp.interledger-test.dev/southtest',
    })
    expect(post?.headers['Idempotency-Key']).toMatch(/^[\da-f-]{36}$/)
    expect(localStorage.getItem('anypay.customerWallet')).toBe(
      '$ilp.interledger-test.dev/southtest',
    )

    await user.click(within(sheet).getByRole('button', { name: 'Approve in my wallet' }))
    expect(assign).toHaveBeenCalledWith(CONSENT_URL)
    expect(within(sheet).getByRole('button', { name: /Opening your wallet/ })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('remembers the wallet from last time', async () => {
    localStorage.setItem('anypay.customerWallet', '$ilp.interledger-test.dev/southtest')
    fakeApi({ [`GET /api/shops/${SHOP.id}`]: { body: SHOP } })
    openPayPage()
    // Only the name is shown; the provider part sits in front of it.
    expect(await screen.findByLabelText('Your wallet address')).toHaveProperty('value', 'southtest')
    expect(screen.getByText('$ilp.interledger-test.dev/')).toBeTruthy()
  })

  it('explains a refused wallet and retries the same attempt, so no payment is made twice', async () => {
    const user = userEvent.setup()
    const calls = fakeApi({
      [`GET /api/shops/${SHOP.id}`]: { body: SHOP },
      [`POST /api/shops/${SHOP.id}/payments`]: [{ networkError: true }, QUOTED],
    })
    openPayPage()
    await enterPayment(user)

    expect((await screen.findByRole('alert')).textContent).toMatch(/No connection/)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('dialog', { name: 'Confirm payment' })

    const keys = calls
      .filter((call) => call.method === 'POST')
      .map((call) => call.headers['Idempotency-Key'])
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
  })

  it('shows why a payment could not start', async () => {
    const user = userEvent.setup()
    fakeApi({
      [`GET /api/shops/${SHOP.id}`]: { body: SHOP },
      [`POST /api/shops/${SHOP.id}/payments`]: apiError(404, 'wallet_not_found'),
    })
    openPayPage()
    await enterPayment(user, '$ilp.interledger-test.dev/nobody')
    expect((await screen.findByRole('alert')).textContent).toBe(
      "There's no wallet at that address.",
    )
  })

  it('cancelling the price sheet returns to editing with focus on Continue', async () => {
    const user = userEvent.setup()
    fakeApi({
      [`GET /api/shops/${SHOP.id}`]: { body: SHOP },
      [`POST /api/shops/${SHOP.id}/payments`]: QUOTED,
    })
    openPayPage()
    await enterPayment(user)
    const sheet = await screen.findByRole('dialog', { name: 'Confirm payment' })
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByLabelText('Amount')).toHaveProperty('value', '50')
  })

  it('says when a QR code points at no shop', async () => {
    fakeApi({ ['GET /api/shops/nope1234']: apiError(404, 'shop_not_found') })
    renderPage(PayPage, { pattern: '/shop/:shopId/pay', path: '/shop/nope1234/pay' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Shop not found' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('offers a retry when the shop could not load', async () => {
    const user = userEvent.setup()
    fakeApi({ [`GET /api/shops/${SHOP.id}`]: [{ networkError: true }, { body: SHOP }] })
    openPayPage()
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { level: 1, name: SHOP.name })).toBeTruthy()
  })
})
