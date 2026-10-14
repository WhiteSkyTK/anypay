// @vitest-environment happy-dom
// Getting around: every screen without the tab bar has a way back or onward, the start page
// knows the phone's shop, and setup never silently replaces a shop.
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getMerchantSession, setMerchantSession } from '@/lib/merchant-session'
import {
  FakeEventSource,
  payment,
  renderPage,
  SESSION,
  SHOP,
  setUpPageTests,
} from '@/testing/fakes'
import { Component as CustomerPage } from './CustomerPage'
import { Component as MerchantSetupPage } from './MerchantSetupPage'
import { Component as OnboardingPage } from './OnboardingPage'
import { Component as PosterPage } from './PosterPage'
import { Component as ReceiptPage } from './ReceiptPage'

setUpPageTests()

const link = (name: string | RegExp) => screen.getByRole('link', { name })

describe('start page', () => {
  it('offers set-up and paying on a new phone', () => {
    renderPage(OnboardingPage, { pattern: '/', path: '/' })
    expect(link(/Set up my shop/).getAttribute('href')).toBe('/merchant/new')
    expect(link("I'm a customer").getAttribute('href')).toBe('/pay')
  })

  it('opens the shop this phone already runs, instead of setting up another', () => {
    setMerchantSession(SESSION)
    renderPage(OnboardingPage, { pattern: '/', path: '/' })
    expect(link(`Open ${SHOP.name}`).getAttribute('href')).toBe('/merchant')
    expect(screen.queryByRole('link', { name: /Set up my shop/ })).toBeNull()
  })

  it('goes straight to the live feed when the shop’s phone starts the app', async () => {
    setMerchantSession(SESSION)
    renderPage(OnboardingPage, { pattern: '/', path: '/?source=pwa', stubs: ['/merchant'] })
    expect(await screen.findByText('Stub page /merchant')).toBeTruthy()
  })
})

describe('customer start (Pay a shop)', () => {
  it('opens a shop from the code on its poster, spaces and all', async () => {
    renderPage(CustomerPage, { pattern: '/pay', path: '/pay', stubs: ['/shop/:shopId/pay'] })
    const go = screen.getByRole('button', { name: 'Go to the shop' })
    expect(go).toHaveProperty('disabled', true)
    await userEvent.type(screen.getByLabelText('Shop code'), ' 7KQM 4XPA ')
    await userEvent.click(go)
    expect(await screen.findByText('Stub page /shop/:shopId/pay')).toBeTruthy()
  })

  it('goes back to the start page when opened directly', async () => {
    renderPage(CustomerPage, { pattern: '/pay', path: '/pay', stubs: ['/'] })
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Stub page /')).toBeTruthy()
  })
})

describe('Back', () => {
  it('returns to the previous screen when there is one', async () => {
    renderPage(CustomerPage, {
      pattern: '/pay',
      path: '/pay',
      before: ['/settings'],
      stubs: ['/settings', '/'],
    })
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Stub page /settings')).toBeTruthy()
  })
})

describe('setting up when the phone already runs a shop', () => {
  it('opens the existing shop by default, and only replaces it on request', async () => {
    setMerchantSession(SESSION)
    renderPage(MerchantSetupPage, { pattern: '/merchant/new', path: '/merchant/new' })
    expect(screen.getByText(`This phone already runs ${SHOP.name}`)).toBeTruthy()
    expect(link(`Open ${SHOP.name}`).getAttribute('href')).toBe('/merchant')

    await userEvent.click(screen.getByRole('button', { name: 'Set up a new shop instead' }))
    expect(screen.getByLabelText('Your wallet address')).toBeTruthy()
    expect(getMerchantSession()).toEqual(SESSION) // nothing replaced until a new shop exists
  })
})

describe('poster', () => {
  const NEW_CODE_SESSION = { ...SESSION, shopId: '7KQM4XPA' }

  it('prints the shop code in two easy-to-read groups', () => {
    setMerchantSession(NEW_CODE_SESSION)
    renderPage(PosterPage, { pattern: '/merchant/poster', path: '/merchant/poster' })
    expect(screen.getByText('7KQM 4XPA')).toBeTruthy()
  })

  it('goes back to the feed it was opened from, instead of stacking another feed', async () => {
    setMerchantSession(NEW_CODE_SESSION)
    const router = renderPage(PosterPage, {
      pattern: '/merchant/poster',
      path: '/merchant/poster',
      before: ['/merchant'],
      state: { from: 'feed' },
      stubs: ['/merchant'],
    })
    await userEvent.click(screen.getByRole('button', { name: 'Go to my shop' }))
    expect(await screen.findByText('Stub page /merchant')).toBeTruthy()
    expect(router.state.historyAction).toBe('POP')
  })

  it('opens the feed after set-up', async () => {
    setMerchantSession(NEW_CODE_SESSION)
    renderPage(PosterPage, {
      pattern: '/merchant/poster',
      path: '/merchant/poster',
      stubs: ['/merchant'],
    })
    await userEvent.click(screen.getByRole('button', { name: 'Go to my shop' }))
    expect(await screen.findByText('Stub page /merchant')).toBeTruthy()
  })
})

describe('receipt', () => {
  function openReceipt() {
    renderPage(ReceiptPage, { pattern: '/receipt/:paymentId', path: `/receipt/${payment().id}` })
    const source = FakeEventSource.latest()
    act(() => source.open())
    return source
  }

  it('offers Done (to Pay a shop) once the payment is finished', () => {
    const source = openReceipt()
    act(() => source.emit('payment', payment({ status: 'awaiting-consent' })))
    expect(screen.queryByRole('link', { name: 'Done' })).toBeNull()
    act(() =>
      source.emit(
        'payment',
        payment({ status: 'completed', completedAt: '2026-10-09T19:53:00.000Z' }),
      ),
    )
    expect(link('Done').getAttribute('href')).toBe('/pay')
  })

  it('never leaves a missing receipt as a dead end', () => {
    const source = openReceipt()
    act(() => source.giveUp())
    expect(link('Done').getAttribute('href')).toBe('/pay')
  })
})
