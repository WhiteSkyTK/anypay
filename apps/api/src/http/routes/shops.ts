import {
  CreatePaymentRequestSchema,
  CreateShopRequestSchema,
  ReplaceMerchantTokenRequestSchema,
  WalletLookupRequestSchema,
} from '@anypay/shared'
import { type RequestHandler, Router } from 'express'
import { z } from 'zod'
import type { IdempotencyRepository } from '../../repositories/idempotency-repository'
import { AppError } from '../../lib/errors'
import type { ShopRecord } from '../../repositories/shop-repository'
import type { PaymentEvents } from '../../services/payment-events'
import type { PaymentService } from '../../services/payment-service'
import { type ShopService, toShop } from '../../services/shop-service'
import type { StreamTickets } from '../../services/stream-tickets'
import type { TabService } from '../../services/tab-service'
import { idempotent } from '../idempotency'
import { openEventStream } from '../sse'
import { parse } from '../validate'

export interface ShopRouteDeps {
  shops: ShopService
  payments: PaymentService
  events: PaymentEvents
  idempotency: IdempotencyRepository
  tabs: TabService
  tickets: StreamTickets
  /** Rate limit for routes that create things or call out to wallets. */
  limit: RequestHandler
  /** Caps open live streams (see limitStreams). */
  streams: RequestHandler
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
  // Only app versions from before feed tickets still put the token in the feed's URL.
  const token = (query as { token?: unknown }).token
  return typeof token === 'string' ? token : undefined
}

const queryTicket = (query: unknown) => {
  const ticket = (query as { ticket?: unknown }).ticket
  return typeof ticket === 'string' ? ticket : undefined
}

export function shopRoutes({
  shops,
  payments,
  events,
  idempotency,
  tabs,
  tickets,
  limit,
  streams,
}: ShopRouteDeps): Router {
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

  /** Active tabs at this shop, with keys and caps: the shop's phone keeps them to work offline. */
  /**
   * The live feed opens with a ticket from here, so the merchant token (sent in a header) never
   * goes into a URL. A ticket works for one minute; the phone asks again when its feed has to.
   */
  router.post('/shops/:shopId/stream-tickets', limit, merchant, (_req, res) => {
    const { ticket, expiresAt } = tickets.issue((res.locals.shop as ShopRecord).id)
    res.status(201).json({ ticket, expiresAt: expiresAt.toISOString() })
  })

  // The feed itself: a ticket, or (older app versions) the merchant token in the query.
  const feedAccess: RequestHandler = async (req, res, next) => {
    const ticket = queryTicket(req.query)
    if (ticket === undefined) return merchant(req, res, next)
    const shop = await shops.getShop(String(req.params.shopId))
    if (tickets.shopFor(ticket) !== shop.id) {
      throw new AppError('merchant_unauthorized', 'This feed ticket has expired', 401)
    }
    res.locals.shop = shop
    next()
  }

  router.get('/shops/:shopId/tabs', merchant, async (_req, res) => {
    res.json({ tabs: await tabs.listForShop(res.locals.shop as ShopRecord) })
  })

  /**
   * "Sign out other phones": the phone sends the token it will use from now on (it chose it, so a
   * lost response can't lock the shop out: it retries with the new token). Every other phone,
   * and every open feed, is signed out at once.
   */
  router.put('/shops/:shopId/merchant-token', limit, merchant, async (req, res) => {
    const { token } = parse(ReplaceMerchantTokenRequestSchema, req.body)
    await shops.replaceMerchantToken(res.locals.shop as ShopRecord, token)
    res.status(204).end()
  })

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
  router.get('/shops/:shopId/events', streams, feedAccess, async (req, res) => {
    const shop = res.locals.shop as ShopRecord
    const since = sinceOf(req.query)
    let unsubscribe = () => undefined as void
    const stream = openEventStream(req, res, () => unsubscribe())
    const offPayments = events.onShop(shop.id, (payment) => stream.send('payment', payment))
    // Other phones were signed out: end this feed. Its reconnect with the old token is refused,
    // and the phone that made the change reconnects with its new one.
    const offSignOut = events.onShopSignOut(shop.id, () => stream.close())
    unsubscribe = () => {
      offPayments()
      offSignOut()
    }
    stream.send('snapshot', await payments.listForShop(shop, since))
  })

  return router
}
