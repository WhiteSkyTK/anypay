// @vitest-environment happy-dom
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { setMerchantSession } from '@/lib/merchant-session'
import {
  apiError,
  FakeEventSource,
  fakeApi,
  payment,
  renderPage,
  SESSION,
  SHOP,
  setUpPageTests,
} from '@/testing/fakes'
import { Component as MerchantPage } from './MerchantPage'

setUpPageTests()

const COMPLETED = payment({
  id: '11111111-1111-4111-8111-111111111111',
  status: 'completed',
  amount: { value: '2500', assetCode: 'COP', assetScale: 2 },
  completedAt: '2026-10-09T19:40:00.000Z',
  createdAt: '2026-10-09T19:39:00.000Z',
})
const NEW_PAYMENT = payment({ id: '22222222-2222-4222-8222-222222222222' })

const openShop = () => {
  setMerchantSession(SESSION)
  return renderPage(MerchantPage, {
    pattern: '/merchant',
    path: '/merchant',
    stubs: ['/merchant/new'],
  })
}

function stream() {
  const source = FakeEventSource.latest()
  act(() => source.open())
  return source
}

function fakeSpeech() {
  const speak = vi.fn()
  vi.stubGlobal('speechSynthesis', { speak, getVoices: () => [{ lang: 'en-ZA' }] })
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      lang = ''
      readonly text: string
      constructor(text: string) {
        this.text = text
      }
    },
  )
  return speak
}

describe('MerchantPage', () => {
  it('asks a phone without a shop to set one up', async () => {
    renderPage(MerchantPage, { pattern: '/merchant', path: '/merchant', stubs: ['/merchant/new'] })
    await userEvent.click(screen.getByRole('link', { name: 'Set up my shop' }))
    expect(await screen.findByText('Stub page /merchant/new')).toBeTruthy()
  })

  it('subscribes with the merchant token and shows a skeleton until the first snapshot', () => {
    openShop()
    const source = FakeEventSource.latest()
    expect(source.url).toContain(`/api/shops/${SHOP.id}/events?token=merchant-token&since=`)
    expect(screen.getByRole('status').textContent).toContain('Connecting')
    expect(screen.queryByText('No payments yet')).toBeNull()
  })

  it('shows today’s payments and total, then each new one as it lands', async () => {
    const speak = fakeSpeech()
    openShop()
    const source = stream()
    act(() =>
      source.emit('snapshot', {
        payments: [],
        total: { value: '0', assetCode: 'COP', assetScale: 2 },
      }),
    )
    expect(screen.getByText('No payments yet')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Live')

    await userEvent.click(screen.getByRole('switch', { name: 'Read payments out loud' }))
    act(() => source.emit('payment', NEW_PAYMENT))
    expect(screen.getByRole('listitem').textContent).toContain('Waiting')
    expect(speak).not.toHaveBeenCalled()

    // The same payment completing: counted, announced on screen and out loud, once.
    const done = { ...NEW_PAYMENT, status: 'completed', completedAt: '2026-10-09T19:53:00.000Z' }
    act(() => source.emit('payment', done))
    act(() => source.emit('payment', done))
    expect(screen.getByRole('listitem').textContent).toContain('Received')
    expect(screen.getByText(/Payment received: COP\s50,00/)).toBeTruthy()
    expect(speak).toHaveBeenCalledOnce()
    expect(speak.mock.calls[0]?.[0]).toMatchObject({
      text: expect.stringMatching(/Payment received, COP\s50,00/),
    })
    expect(screen.getByRole('region', { name: 'Taken today' }).textContent).toMatch(/COP\s50,00/)
  })

  it('does not announce payments that were already in the snapshot', () => {
    const speak = fakeSpeech()
    localStorage.setItem('anypay.voice', 'on')
    openShop()
    const source = stream()
    act(() =>
      source.emit('snapshot', {
        payments: [COMPLETED],
        total: { value: '2500', assetCode: 'COP', assetScale: 2 },
      }),
    )
    expect(screen.getByRole('region', { name: 'Taken today' }).textContent).toMatch(/COP\s25,00/)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(speak).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'merchant_unauthorized'],
    [404, 'shop_not_found'],
  ])('signs the phone out when the shop answers %i %s', async (status, code) => {
    fakeApi({ [`GET /api/shops/${SHOP.id}/payments`]: apiError(status, code) })
    openShop()
    act(() => FakeEventSource.latest().giveUp())

    expect(await screen.findByText('This phone is signed out of the shop')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Set up again' }))
    expect(await screen.findByText('No shop on this phone yet')).toBeTruthy()
  })

  it('keeps trying when the stream drops for another reason (API restarting, host waking)', async () => {
    const calls = fakeApi({ [`GET /api/shops/${SHOP.id}/payments`]: { networkError: true } })
    openShop()
    const first = FakeEventSource.latest()
    act(() => first.giveUp())
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(screen.getByRole('status').textContent).toContain('Not connected')
    expect(screen.queryByText('No payments yet')).toBeNull()

    // A new connection after a short wait; the server's snapshot brings the feed back.
    await waitFor(() => expect(FakeEventSource.latest()).not.toBe(first), { timeout: 3000 })
    const second = stream()
    act(() => second.emit('snapshot', { payments: [COMPLETED], total: COMPLETED.amount }))
    expect(screen.getByRole('status').textContent).toContain('Live')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('exports today’s payments as CSV with the merchant token', async () => {
    const calls = fakeApi({
      [`GET /api/shops/${SHOP.id}/export.csv`]: { body: 'completed_at,amount\r\n' },
    })
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:csv', revokeObjectURL: vi.fn() }),
    )
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    openShop()
    stream()

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(calls[0]?.headers.Authorization).toBe('Bearer merchant-token')
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toMatch(new RegExp(`^anypay-${SHOP.id}-\\d{4}-\\d{2}-\\d{2}\\.csv$`))
  })

  it('says when the export failed', async () => {
    fakeApi({ [`GET /api/shops/${SHOP.id}/export.csv`]: apiError(429, 'rate_limited') })
    openShop()
    stream()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Too many tries/)
  })
})
