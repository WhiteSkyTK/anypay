// @vitest-environment happy-dom
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getMerchantSession, setMerchantSession } from '@/lib/merchant-session'
import { startOfToday } from '@/lib/format'
import {
  type ApiCall,
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

/** The feed's stream, once its ticket has come back and it opened. */
async function stream() {
  const source = await waitFor(() => FakeEventSource.latest())
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

  it('opens the feed with a short-lived ticket, never the merchant token in its URL', async () => {
    const calls = fakeApi({})
    openShop()
    expect(screen.getByRole('status').textContent).toContain('Connecting')
    const source = await waitFor(() => FakeEventSource.latest())
    expect(source.url).toMatch(
      new RegExp(`/api/shops/${SHOP.id}/events[?]ticket=feed-ticket-[0-9]+&since=`),
    )
    expect(source.url).not.toContain('merchant-token')
    expect(calls[0]?.headers.Authorization).toBe('Bearer merchant-token') // in a header instead
    expect(screen.queryByText('No payments yet')).toBeNull() // a skeleton until the snapshot
  })

  it('shows today’s payments and total, then each new one as it lands', async () => {
    const speak = fakeSpeech()
    openShop()
    const source = await stream()
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

  it('does not announce payments that were already in the snapshot', async () => {
    const speak = fakeSpeech()
    localStorage.setItem('anypay.voice', 'on')
    openShop()
    const source = await stream()
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
    fakeApi({ [`POST /api/shops/${SHOP.id}/stream-tickets`]: apiError(status, code) })
    openShop()

    expect(await screen.findByText('This phone is signed out of the shop')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Set up again' }))
    expect(await screen.findByText('No shop on this phone yet')).toBeTruthy()
  })

  it('finishes "sign out other phones" if it went through but the answer was lost', async () => {
    const next = 'n'.repeat(43)
    // The server already switched to the token this phone chose; the old one is refused.
    const onlyNext = (ok: { status: number; body?: unknown }) => (call: ApiCall) =>
      call.headers.Authorization === `Bearer ${next}` ? ok : apiError(401, 'merchant_unauthorized')
    fakeApi({
      [`POST /api/shops/${SHOP.id}/stream-tickets`]: onlyNext({
        status: 201,
        body: { ticket: 'after-switch', expiresAt: '2099-01-01T00:00:00.000Z' },
      }),
      [`PUT /api/shops/${SHOP.id}/merchant-token`]: onlyNext({ status: 200 }),
    })
    setMerchantSession({ ...SESSION, nextToken: next })
    renderPage(MerchantPage, { pattern: '/merchant', path: '/merchant' })

    const source = await waitFor(() => FakeEventSource.latest())
    expect(source.url).toContain('ticket=after-switch')
    expect(getMerchantSession()).toMatchObject({ token: next, nextToken: undefined })
    expect(screen.queryByText('This phone is signed out of the shop')).toBeNull()
  })

  it('keeps trying when the stream drops for another reason (API restarting, host waking)', async () => {
    const calls = fakeApi({})
    openShop()
    const first = await waitFor(() => FakeEventSource.latest())
    act(() => first.giveUp())
    expect(screen.getByRole('status').textContent).toContain('Not connected')
    expect(screen.queryByText('No payments yet')).toBeNull()

    // After a short wait, a new ticket and a new connection; the snapshot brings the feed back.
    await waitFor(() => expect(FakeEventSource.latest()).not.toBe(first), { timeout: 3000 })
    expect(calls.filter((call) => call.path.endsWith('/stream-tickets'))).toHaveLength(2)
    const second = await stream()
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
    await stream()

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(calls[0]?.headers.Authorization).toBe('Bearer merchant-token')
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toMatch(new RegExp(`^anypay-${SHOP.id}-\\d{4}-\\d{2}-\\d{2}\\.csv$`))
  })

  it('says when the export failed', async () => {
    fakeApi({ [`GET /api/shops/${SHOP.id}/export.csv`]: apiError(429, 'rate_limited') })
    openShop()
    await stream()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Too many tries/)
  })
})

describe('MerchantPage, remembered feed', () => {
  const cacheFor = (day: string) =>
    localStorage.setItem(
      `anypay.cache.feed.${SHOP.id}`,
      JSON.stringify({ day, payments: [COMPLETED], total: COMPLETED.amount }),
    )

  it('shows today’s payments from the phone at once, before the live feed connects', () => {
    cacheFor(startOfToday().toISOString())
    openShop()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Taken today' }).textContent).toMatch(/COP\s25,00/)
    expect(screen.getByRole('status').textContent).toContain('Connecting')
  })

  it('forgets yesterday’s feed', () => {
    cacheFor(new Date(startOfToday().getTime() - 86_400_000).toISOString())
    openShop()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.queryByText('No payments yet')).toBeNull() // skeleton until the snapshot
  })

  it('keeps the phone’s copy up to date', async () => {
    openShop()
    const source = await stream()
    act(() => source.emit('snapshot', { payments: [COMPLETED], total: COMPLETED.amount }))
    const saved = JSON.parse(localStorage.getItem(`anypay.cache.feed.${SHOP.id}`) ?? '{}')
    expect(saved.payments).toHaveLength(1)
  })
})
