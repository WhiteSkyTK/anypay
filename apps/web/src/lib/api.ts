import {
  ApiErrorSchema,
  ConfigResponseSchema,
  type CreatePaymentRequest,
  CreatePaymentResponseSchema,
  type CreateShopRequest,
  CreateShopResponseSchema,
  type OpenTabRequest,
  OpenTabResponseSchema,
  PaymentSummarySchema,
  ShopPaymentsResponseSchema,
  ShopSchema,
  ShopTabsResponseSchema,
  TabSummarySchema,
  VoucherStatusSchema,
  type VoucherSubmission,
  WalletLookupResponseSchema,
} from '@anypay/shared'
import type { z } from 'zod/mini'
import { trackRequest } from './pending-requests'
import { noteServerDate } from './server-clock'
import { isSimulatedOffline } from './simulated-offline'

// Empty in development: Vite proxies /api to the API, so the browser stays same-origin.
const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

// Long enough for a free server waking from sleep (up to a minute), short enough not to leave a
// customer staring at a spinner on a dead connection.
const REQUEST_TIMEOUT_MS = 60_000

/** A failed API call, with the API's error code ('network_error' when there was no response). */
export class ApiRequestError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  /** Merchant token for the shop's own data. */
  token?: string
  /** Required by the API on requests that create things or move money. */
  idempotencyKey?: string
}

async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
  // Demo mode's "Simulate offline" fails every request exactly like a dead connection.
  if (isSimulatedOffline()) throw new ApiRequestError('network_error', 'No connection', 0)
  const sentAt = Date.now()
  const done = trackRequest(sentAt)
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // A stalled connection (weak signal) would otherwise spin forever. Every request that moves
      // money carries an Idempotency-Key, so trying again after a timeout is always safe.
      signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw timedOut
      ? new ApiRequestError('timeout', 'No answer in time', 0)
      : new ApiRequestError('network_error', 'No connection', 0)
  } finally {
    done()
  }
  noteServerDate(response.headers.get('Date'), sentAt, Date.now())
  if (response.ok) return response
  throw await toRequestError(response)
}

async function toRequestError(response: Response): Promise<ApiRequestError> {
  const error = ApiErrorSchema.safeParse(await response.json().catch(() => undefined))
  if (error.success) {
    const { code, message } = error.data.error
    return new ApiRequestError(code, message, response.status)
  }
  // Not our API answering: the host's own page while the server sleeps, restarts or deploys.
  const gateway = response.status >= 502 && response.status <= 504
  return new ApiRequestError(
    gateway ? 'unavailable' : 'unknown',
    response.statusText,
    response.status,
  )
}

/** Every response is checked against the shared contract, so a mismatch fails loudly. */
async function request<S extends z.ZodMiniType>(
  path: string,
  schema: S,
  options?: RequestOptions,
): Promise<z.infer<S>> {
  const response = await send(path, options)
  return schema.parse(await response.json())
}

const enc = encodeURIComponent

export const api = {
  config: () => request('/api/config', ConfigResponseSchema),

  lookupWallet: (walletAddress: string) =>
    request('/api/wallet-addresses/lookup', WalletLookupResponseSchema, {
      method: 'POST',
      body: { walletAddress },
    }),

  createShop: (body: CreateShopRequest, idempotencyKey: string) =>
    request('/api/shops', CreateShopResponseSchema, { method: 'POST', body, idempotencyKey }),

  getShop: (shopId: string) => request(`/api/shops/${enc(shopId)}`, ShopSchema),

  startPayment: (shopId: string, body: CreatePaymentRequest, idempotencyKey: string) =>
    request(`/api/shops/${enc(shopId)}/payments`, CreatePaymentResponseSchema, {
      method: 'POST',
      body,
      idempotencyKey,
    }),

  getPayment: (paymentId: string) =>
    request(`/api/payments/${enc(paymentId)}`, PaymentSummarySchema),

  shopPayments: (shopId: string, token: string, since: Date) =>
    request(
      `/api/shops/${enc(shopId)}/payments?since=${enc(since.toISOString())}`,
      ShopPaymentsResponseSchema,
      { token },
    ),

  /** Signs out every other phone: from now on only `next` (chosen by this phone) works. */
  replaceMerchantToken: async (shopId: string, token: string, next: string): Promise<void> => {
    await send(`/api/shops/${enc(shopId)}/merchant-token`, {
      method: 'PUT',
      token,
      body: { token: next },
    })
  },

  exportCsv: async (shopId: string, token: string, since: Date): Promise<Blob> => {
    const response = await send(
      `/api/shops/${enc(shopId)}/export.csv?since=${enc(since.toISOString())}`,
      { token },
    )
    return response.blob()
  },

  // --- Offline Digital Tab ---

  openTab: (shopId: string, body: OpenTabRequest, idempotencyKey: string) =>
    request(`/api/shops/${enc(shopId)}/tabs`, OpenTabResponseSchema, {
      method: 'POST',
      body,
      idempotencyKey,
    }),

  getTab: (tabId: string) => request(`/api/tabs/${enc(tabId)}`, TabSummarySchema),

  /** The shop's active tabs with keys and caps, so its phone can check vouchers offline. */
  shopTabs: (shopId: string, token: string) =>
    request(`/api/shops/${enc(shopId)}/tabs`, ShopTabsResponseSchema, { token }),

  submitVoucher: (tabId: string, body: VoucherSubmission, idempotencyKey: string) =>
    request(`/api/tabs/${enc(tabId)}/vouchers`, VoucherStatusSchema, {
      method: 'POST',
      body,
      idempotencyKey,
    }),

  getVoucher: (nonce: string) => request(`/api/vouchers/${enc(nonce)}`, VoucherStatusSchema),

  /** SSE: EventSource can't send headers, so the token rides in the query (never logged). */
  shopEventsUrl: (shopId: string, token: string, since: Date) =>
    `${BASE_URL}/api/shops/${enc(shopId)}/events?token=${enc(token)}&since=${enc(since.toISOString())}`,

  paymentEventsUrl: (paymentId: string) => `${BASE_URL}/api/payments/${enc(paymentId)}/events`,
}
