import {
  CreatePaymentRequestSchema,
  CreateShopRequestSchema,
  WalletLookupRequestSchema,
} from '@anypay/shared'
import { type RequestHandler, Router } from 'express'
import { z } from 'zod'
import type { IdempotencyRepository } from '../../repositories/idempotency-repository'
import type { ShopRecord } from '../../repositories/shop-repository'
import type { PaymentEvents } from '../../services/payment-events'
import type { PaymentService } from '../../services/payment-service'
import { type ShopService, toShop } from '../../services/shop-service'
import { idempotent } from '../idempotency'
import { openEventStream } from '../sse'
import { parse } from '../validate'

export interface ShopRouteDeps {
  shops: ShopService
  payments: PaymentService
  events: PaymentEvents
  idempotency: IdempotencyRepository
  /** Rate limit for routes that create things or call out to wallets. */
  limit: RequestHandler
}

const DAY_MS = 24 * 60 * 60 * 1000
// The phone sends its local midnight, so "today" matches the shop's own day.
const SinceQuerySchema = z.object({ since: z.iso.datetime({ offset: true }).optional() })

const sinceOf = (query: unknown) => {
  const { since } = parse(SinceQuerySchema, query)
  return since ? new Date(since) : new Date(Date.now() - DAY_MS)
}

function bearerToken(header: string | undefined, query: unknown): string | undefined {
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length)
  // EventSource can't send headers, so the live feed passes the token in the query instead
  // (request logs strip query strings, so it is never written to a log).
  const token = (query as { token?: unknown }).token
  return typeof token === 'string' ? token : undefined
}

export function shopRoutes({ shops, payments, events, idempotency, limit }: ShopRouteDeps): Router {
  const router = Router()

  /** Onboarding step 1: check a wallet address and see its currency before creating the shop. */
  router.post('/wallet-addresses/lookup', limit, async (req, res) => {
    const { walletAddress } = parse(WalletLookupRequestSchema, req.body)
    res.json(await shops.lookupWallet(walletAddress))
  })

  router.post('/shops', limit, idempotent(idempotency, 'create-shop'), async (req, res) => {
    res.status(201).json(await shops.createShop(parse(CreateShopRequestSchema, req.body)))
  })

  /** Public shop profile for the customer's pay screen (the id is printed on the QR poster). */
  router.get('/shops/:shopId', async (req, res) => {
    res.json(toShop(await shops.getShop(req.params.shopId)))
  })

  router.post(
    '/shops/:shopId/payments',
    limit,
    idempotent(idempotency, 'create-payment'),
    async (req, res) => {
      const request = parse(CreatePaymentRequestSchema, req.body)
      res.status(201).json(await payments.startPayment(String(req.params.shopId), request))
    },
  )

  // --- The shop's own data: only for the phone holding the merchant token. ---

  const merchant: RequestHandler = async (req, res, next) => {
    const token = bearerToken(req.get('authorization'), req.query)
    res.locals.shop = await shops.authenticateMerchant(String(req.params.shopId), token)
    next()
  }

  router.get('/shops/:shopId/payments', merchant, async (req, res) => {
    res.json(await payments.listForShop(res.locals.shop as ShopRecord, sinceOf(req.query)))
  })

  router.get('/shops/:shopId/export.csv', merchant, async (req, res) => {
    const shop = res.locals.shop as ShopRecord
    const day = new Date().toISOString().slice(0, 10)
    res
      .type('text/csv; charset=utf-8')
      .attachment(`anypay-${shop.id}-${day}.csv`)
      .send(await payments.csvForShop(shop, sinceOf(req.query)))
  })

  /** Live feed: a snapshot first (also after every reconnect), then each change as it happens. */
  router.get('/shops/:shopId/events', merchant, async (req, res) => {
    const shop = res.locals.shop as ShopRecord
    const since = sinceOf(req.query)
    let unsubscribe = () => undefined as void
    const stream = openEventStream(req, res, () => unsubscribe())
    unsubscribe = events.onShop(shop.id, (payment) => stream.send('payment', payment))
    stream.send('snapshot', await payments.listForShop(shop, since))
  })

  return router
}
