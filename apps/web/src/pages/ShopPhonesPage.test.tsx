// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getMerchantSession, setMerchantSession } from '@/lib/merchant-session'
import { fakeApi, renderPage, SESSION, SHOP, setUpPageTests } from '@/testing/fakes'
import { Component as ShopPhonesPage } from './ShopPhonesPage'

setUpPageTests()

const openPage = () =>
  renderPage(ShopPhonesPage, { pattern: '/merchant/phones', path: '/merchant/phones' })

describe('your shop on other phones', () => {
  it('shows the sign-in code only when asked', async () => {
    setMerchantSession(SESSION)
    openPage()
    const label = `Sign-in code for ${SHOP.name}`
    expect(screen.queryByRole('img', { name: label })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Show sign-in code' }))
    expect(await screen.findByRole('img', { name: label })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Hide the code' }))
    expect(screen.queryByRole('img', { name: label })).toBeNull()
  })

  it('signs out other phones after confirming, keeping this one signed in', async () => {
    const calls = fakeApi({ [`PUT /api/shops/${SHOP.id}/merchant-token`]: { status: 200 } })
    setMerchantSession(SESSION)
    openPage()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out other phones' }))
    const sheet = await screen.findByRole('dialog', { name: 'Sign out other phones?' })
    expect(calls).toHaveLength(0) // nothing happens before the confirmation
    await userEvent.click(within(sheet).getByRole('button', { name: 'Sign out other phones' }))

    expect(await screen.findByText(/Other phones are signed out/)).toBeTruthy()
    expect(calls).toHaveLength(1)
    expect(getMerchantSession()?.token).not.toBe(SESSION.token)
  })

  it('cancelling the confirmation changes nothing', async () => {
    const calls = fakeApi({})
    setMerchantSession(SESSION)
    openPage()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out other phones' }))
    const sheet = await screen.findByRole('dialog', { name: 'Sign out other phones?' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    expect(calls).toHaveLength(0)
    expect(getMerchantSession()).toEqual(SESSION)
  })

  it('sends a phone without a shop to set-up', async () => {
    renderPage(ShopPhonesPage, {
      pattern: '/merchant/phones',
      path: '/merchant/phones',
      stubs: ['/merchant/new'],
    })
    expect(await screen.findByText('Stub page /merchant/new')).toBeTruthy()
  })
})
