import type { ConfigResponse } from '@anypay/shared'
import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import type { Container } from './container'
import { errorHandler, notFound } from './http/errors'
import { IDEMPOTENCY_HEADER } from './http/idempotency'
import { createRateLimit } from './http/rate-limit'
import { CORRELATION_HEADER, requestLogger } from './http/request-logger'
import { healthRouter } from './http/routes/health'
import { paymentRoutes } from './http/routes/payments'
import { shopRoutes } from './http/routes/shops'

// Payment requests are small JSON bodies; a low limit blunts abuse.
const BODY_LIMIT = '16kb'

export interface AppOptions {
  /** Requests per minute per IP on routes that create things or call wallets. */
  rateLimitPerMinute?: number
}

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp(container: Container, options: AppOptions = {}): Express {
  const { env } = container
  const app = express()
  app.disable('x-powered-by')
  // Behind a hosting load balancer, so rate limits and logs see the client's IP, not the proxy's.
  app.set('trust proxy', env.TRUST_PROXY)
  app.use(requestLogger(container.logger))
  app.use(helmet())
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization', IDEMPOTENCY_HEADER, CORRELATION_HEADER],
      exposedHeaders: [CORRELATION_HEADER, 'Idempotent-Replayed'],
      maxAge: 600,
    }),
  )
  app.use(express.json({ limit: BODY_LIMIT }))

  app.use(healthRouter(container.version))
  app.get('/api/config', (_req, res) => {
    const body: ConfigResponse = { demoMode: env.DEMO_MODE, version: container.version }
    res.json(body)
  })
  const limit = createRateLimit(options.rateLimitPerMinute ?? 30)
  app.use(
    '/api',
    shopRoutes({
      shops: container.shopService,
      payments: container.paymentService,
      events: container.paymentEvents,
      idempotency: container.idempotency,
      limit,
    }),
  )
  app.use(
    '/api',
    paymentRoutes({
      payments: container.paymentService,
      events: container.paymentEvents,
      webOrigin: env.WEB_ORIGIN[0] ?? 'http://localhost:5173',
    }),
  )

  app.use(notFound)
  app.use(errorHandler)
  return app
}
