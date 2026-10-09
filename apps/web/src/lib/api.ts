import {
  ApiErrorSchema,
  ConfigResponseSchema,
  type CreatePaymentRequest,
  CreatePaymentResponseSchema,
  type CreateShopRequest,
  CreateShopResponseSchema,
  PaymentSummarySchema,
  ShopPaymentsResponseSchema,
  ShopSchema,
  WalletLookupResponseSchema,
} from '@anypay/shared'
import type { z } from 'zod'

// Empty in development: Vite proxies /api to the API, so the browser stays same-origin.
const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

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
  method?: 'GET' | 'POST'
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
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiRequestError('network_error', 'No connection', 0)
  }
  if (response.ok) return response
  const error = ApiErrorSchema.safeParse(await response.json().catch(() => undefined))
  const { code, message } = error.success
    ? error.data.error
    : { code: 'unknown', message: response.statusText }
  throw new ApiRequestError(code, message, response.status)
}

/** Every response is checked against the shared contract, so a mismatch fails loudly. */
async function request<S extends z.ZodType>(
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

  exportCsv: async (shopId: string, token: string, since: Date): Promise<Blob> => {
    const response = await send(
      `/api/shops/${enc(shopId)}/export.csv?since=${enc(since.toISOString())}`,
      { token },
    )
    return response.blob()
  },

  /** SSE: EventSource can't send headers, so the token rides in the query (never logged). */
  shopEventsUrl: (shopId: string, token: string, since: Date) =>
    `${BASE_URL}/api/shops/${enc(shopId)}/events?token=${enc(token)}&since=${enc(since.toISOString())}`,

  paymentEventsUrl: (paymentId: string) => `${BASE_URL}/api/payments/${enc(paymentId)}/events`,
}
