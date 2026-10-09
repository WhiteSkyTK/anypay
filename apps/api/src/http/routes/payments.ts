import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../lib/errors'
import type { PaymentEvents } from '../../services/payment-events'
import type { PaymentService } from '../../services/payment-service'
import { openEventStream } from '../sse'
import { parse } from '../validate'

export interface PaymentRouteDeps {
  payments: PaymentService
  events: PaymentEvents
  webOrigin: string
}

const PaymentIdSchema = z.uuid()
const CallbackQuerySchema = z.object({
  interact_ref: z.string().max(512).optional(),
  hash: z.string().max(512).optional(),
  result: z.string().max(64).optional(),
})

function paymentId(raw: unknown): string {
  const result = PaymentIdSchema.safeParse(raw)
  if (!result.success) throw new AppError('payment_not_found', 'No such payment', 404)
  return result.data
}

const isFinal = (status: string) => status === 'completed' || status === 'failed'

export function paymentRoutes({ payments, events, webOrigin }: PaymentRouteDeps): Router {
  const router = Router()

  /** The receipt: anyone holding the (unguessable) payment id may see its status. */
  router.get('/payments/:paymentId', async (req, res) => {
    res.json(await payments.getPayment(paymentId(req.params.paymentId)))
  })

  /**
   * Where the customer's wallet sends them after the approval screen (CLAUDE.md step 4). Always
   * ends on the receipt page: a customer should never see a JSON error in their browser.
   */
  router.get('/payments/:paymentId/callback', async (req, res) => {
    const id = paymentId(req.params.paymentId)
    const query = parse(CallbackQuerySchema, req.query)
    try {
      res.redirect(303, await payments.handleCallback(id, query))
    } catch (error) {
      if (error instanceof AppError && error.status === 404) throw error
      req.log.error({ err: error, paymentId: id }, 'Consent callback failed')
      res.redirect(303, `${webOrigin}/receipt/${id}?error=callback`)
    }
  })

  /** Live receipt: the current status now, then every change until the payment is final. */
  router.get('/payments/:paymentId/events', async (req, res) => {
    const id = paymentId(req.params.paymentId)
    const current = await payments.getPayment(id)
    let unsubscribe = () => undefined as void
    const stream = openEventStream(req, res, () => unsubscribe())
    stream.send('payment', current)
    if (isFinal(current.status)) return stream.close()
    unsubscribe = events.onPayment(id, (payment) => {
      stream.send('payment', payment)
      if (isFinal(payment.status)) stream.close()
    })
  })

  return router
}
