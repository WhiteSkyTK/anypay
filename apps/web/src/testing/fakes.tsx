// Test doubles for page tests: a scripted API (fetch), a controllable EventSource and a router.
// Pages run with their real hooks, API client and translations; only the network is fake.
import type { PaymentSummary, Shop } from '@anypay/shared'
import { cleanup, render } from '@testing-library/react'
import type { ComponentType } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { RouteError } from '@/app/RouteError'
import { initI18n } from '@/i18n'
import { setMerchantSession } from '@/lib/merchant-session'

export const SHOP: Shop = {
  id: 't8twHh2K',
  name: 'Kasi Corner Spaza',
  walletAddress: 'https://ilp.interledger-test.dev/merchanttest',
  assetCode: 'COP',
  assetScale: 2,
}

export const SESSION = {
  shopId: SHOP.id,
  name: SHOP.name,
  token: 'merchant-token',
  assetCode: SHOP.assetCode,
  assetScale: SHOP.assetScale,
}

export function payment(overrides: Partial<PaymentSummary> = {}): PaymentSummary {
  return {
    id: '70125f46-5c8b-48f5-afea-0b345a6468ad',
    shopId: SHOP.id,
    shopName: SHOP.name,
    status: 'awaiting-consent',
    amount: { value: '5000', assetCode: 'COP', assetScale: 2 },
    debitAmount: { value: '27', assetCode: 'ZAR', assetScale: 2 },
    createdAt: '2026-10-09T19:52:00.000Z',
    ...overrides,
  }
}

interface Reply {
  status?: number
  body?: unknown
  /** Simulates no connection at all. */
  networkError?: boolean
}

export interface ApiCall {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
}

type Route = Reply | ((call: ApiCall) => Reply)

const FEED_TICKET = /^POST \/api\/shops\/[^/]+\/stream-tickets$/
// A new ticket every time, as the API gives: each (re)connection opens a different URL.
let tickets = 0
const ticketReply = (): Reply => ({
  status: 201,
  body: { ticket: 'feed-ticket-' + ++tickets, expiresAt: '2099-01-01T00:00:00.000Z' },
})

/**
 * Replaces fetch with scripted replies, keyed by "METHOD /path" (query string ignored). A route
 * given a list replies with each entry in turn, then repeats the last one. The shop feed's tickets
 * are granted unless a test scripts that route, so feed tests stay about the feed.
 */
export function fakeApi(routes: Record<string, Route | Route[]>) {
  const calls: ApiCall[] = []
  const served = new Map<string, number>()
  const answer = (url: string, init: RequestInit): Response => {
    const { pathname } = new URL(url, 'http://localhost')
    const call: ApiCall = {
      method: init.method ?? 'GET',
      path: pathname,
      headers: (init.headers ?? {}) as Record<string, string>,
      // The app only ever sends JSON text.
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    }
    calls.push(call)
    const key = `${call.method} ${pathname}`
    const route = routes[key] ?? (FEED_TICKET.test(key) ? ticketReply : undefined)
    if (!route) throw new Error(`Unexpected API call: ${key}`)
    const count = served.get(key) ?? 0
    served.set(key, count + 1)
    const entry = Array.isArray(route) ? route[Math.min(count, route.length - 1)] : route
    const reply = typeof entry === 'function' ? entry(call) : entry
    if (!reply || reply.networkError) throw new TypeError('Failed to fetch')
    const body = typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body ?? {})
    return new Response(body, { status: reply.status ?? 200 })
  }
  // Like the real fetch, anything thrown above becomes a rejected promise.
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) =>
    Promise.resolve().then(() => answer(url, init)),
  )
  return calls
}

export const apiError = (status: number, code: string): Reply => ({
  status,
  body: { error: { code, message: code } },
})

/** An EventSource the test drives: open it, push named events, or make it give up. */
export class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static readonly instances: FakeEventSource[] = []

  readyState = FakeEventSource.CONNECTING
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  readonly #listeners = new Map<string, Set<(message: MessageEvent<string>) => void>>()

  readonly url: string

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  static latest(): FakeEventSource {
    const source = FakeEventSource.instances.at(-1)
    if (!source) throw new Error('No EventSource was opened')
    return source
  }

  addEventListener(event: string, listener: (message: MessageEvent<string>) => void) {
    const set = this.#listeners.get(event) ?? new Set()
    set.add(listener)
    this.#listeners.set(event, set)
  }

  removeEventListener(event: string, listener: (message: MessageEvent<string>) => void) {
    this.#listeners.get(event)?.delete(listener)
  }

  close() {
    this.readyState = FakeEventSource.CLOSED
  }

  open() {
    this.readyState = FakeEventSource.OPEN
    this.onopen?.()
  }

  emit(event: string, data: unknown) {
    const message = new MessageEvent('message', { data: JSON.stringify(data) })
    this.#listeners.get(event)?.forEach((listener) => listener(message))
  }

  /** The server refused the stream (e.g. 401/404): the browser stops retrying. */
  giveUp() {
    this.readyState = FakeEventSource.CLOSED
    this.onerror?.()
  }
}

/** Renders one page at `path`, plus stub pages for where it may navigate to. */
interface RenderPageOptions {
  pattern: string
  path: string
  /** Stub pages the page may navigate to; each renders 'Stub page <path>'. */
  stubs?: string[]
  /** In-app history before this page, so 'Back' has somewhere to go. */
  before?: string[]
  /** Navigation state the page was opened with. */
  state?: unknown
}

export function renderPage(
  Page: ComponentType,
  { pattern, path, stubs = [], before = [], state }: RenderPageOptions,
) {
  const router = createMemoryRouter(
    [
      // The app's own error screen, as in router.tsx, so tests see what a phone would.
      { path: pattern, Component: Page, ErrorBoundary: RouteError },
      ...stubs.map((stub) => ({ path: stub, element: <p>{`Stub page ${stub}`}</p> })),
    ],
    { initialEntries: [...before, state === undefined ? path : { pathname: path, state }] },
  )
  render(<RouterProvider router={router} />)
  return router
}

/** Shared setup for page tests: English strings, a fresh EventSource fake, clean storage. */
export function setUpPageTests() {
  beforeAll(async () => {
    await initI18n()
  })
  beforeEach(() => {
    vi.stubGlobal('EventSource', FakeEventSource)
    // As on https or localhost (happy-dom leaves it unset): offline tabs need a secure context.
    vi.stubGlobal('isSecureContext', true)
    // No real network in tests: an unscripted request fails loudly.
    fakeApi({})
    // Screens render as with "reduce motion" on: the success tick appears still. happy-dom's Web
    // Animations reject when a test unmounts a screen mid-animation, and no test checks motion.
    const matchMedia = window.matchMedia.bind(window)
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      const list = matchMedia(query)
      if (!query.includes('prefers-reduced-motion')) return list
      return Object.defineProperty(list, 'matches', { value: true })
    })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    FakeEventSource.instances.length = 0
    setMerchantSession(null)
    localStorage.clear()
  })
}
