import { OpenTabRequestSchema, VoucherSubmissionSchema } from '@anypay/shared'
import { type RequestHandler, Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../lib/errors'
import type { IdempotencyRepository } from '../../repositories/idempotency-repository'
import type { TabService } from '../../services/tab-service'
import { idempotent } from '../idempotency'
import { parse } from '../validate'

export interface TabRouteDeps {
  tabs: TabService
  idempotency: IdempotencyRepository
  /** Rate limit for routes that create things or call out to wallets. */
  limit: RequestHandler
  webOrigin: string
}

const TabIdSchema = z.string().regex(/^[\w-]{12}$/)
const NonceSchema = z.string().regex(/^[\w-]{12,32}$/)
const CallbackQuerySchema = z.object({
  interact_ref: z.string().max(512).optional(),
  hash: z.string().max(512).optional(),
  result: z.string().max(64).optional(),
})

function tabId(raw: unknown): string {
  const result = TabIdSchema.safeParse(raw)
  if (!result.success) throw new AppError('tab_not_found', 'No such tab', 404)
  return result.data
}

/**
 * Offline Digital Tab (Feature 4). Opening a tab and the wallet callback need a connection once;
 * vouchers are signed offline and arrive here whenever either phone has signal. The voucher's
 * signature is its authentication: only the customer's phone holds the key.
 */
export function tabRoutes({ tabs, idempotency, limit, webOrigin }: TabRouteDeps): Router {
  const router = Router()

  router.post(
    '/shops/:shopId/tabs',
    limit,
    idempotent(idempotency, 'open-tab'),
    async (req, res) => {
      const request = parse(OpenTabRequestSchema, req.body)
      res.status(201).json(await tabs.openTab(String(req.params.shopId), request))
    },
  )

  /** Where the customer's wallet sends them after approving the weekly cap. Always a redirect. */
  router.get('/tabs/:tabId/callback', async (req, res) => {
    const id = tabId(req.params.tabId)
    const query = parse(CallbackQuerySchema, req.query)
    try {
      res.redirect(303, await tabs.handleCallback(id, query))
    } catch (error) {
      if (error instanceof AppError && error.status === 404) throw error
      req.log.error({ err: error, tabId: id }, 'Tab consent callback failed')
      res.redirect(303, `${webOrigin}/tab/${id}?error=callback`)
    }
  })

  /** The customer's view of a tab: anyone holding the (unguessable) tab id. */
  router.get('/tabs/:tabId', async (req, res) => {
    res.json(await tabs.getTab(tabId(req.params.tabId)))
  })

  /** Either phone, whenever it has signal. Idempotent twice over: by key and by voucher nonce. */
  router.post(
    '/tabs/:tabId/vouchers',
    limit,
    idempotent(idempotency, 'voucher'),
    async (req, res) => {
      const submission = parse(VoucherSubmissionSchema, req.body)
      res.json(await tabs.submitVoucher(tabId(req.params.tabId), submission))
    },
  )

  router.get('/vouchers/:nonce', async (req, res) => {
    const nonce = NonceSchema.safeParse(req.params.nonce)
    if (!nonce.success) throw new AppError('voucher_not_found', 'No such voucher', 404)
    res.json(await tabs.getVoucher(nonce.data))
  })

  return router
}
