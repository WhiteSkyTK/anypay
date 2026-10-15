import type { ConfigResponse } from '@anypay/shared'
import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import type { Container } from './container'
import { errorHandler, notFound } from './http/errors'
import { IDEMPOTENCY_HEADER } from './http/idempotency'
import { createRateLimit } from './http/rate-limit'
import { limitStreams, type StreamLimits } from './http/stream-limit'
import { CORRELATION_HEADER, requestLogger } from './http/request-logger'
import { healthRouter } from './http/routes/health'
import { paymentRoutes } from './http/routes/payments'
import { shopRoutes } from './http/routes/shops'
import { tabRoutes } from './http/routes/tabs'

// Payment requests are small JSON bodies; a low limit blunts abuse.
const BODY_LIMIT = '16kb'

export interface AppOptions {
  /** Requests per minute per IP on routes that create things or call wallets. */
  rateLimitPerMinute?: number
  /** Requests per minute per IP on every API route: a ceiling against scripted floods. */
  requestsPerMinute?: number
  /** Open live streams per IP and in total. */
  streamLimits?: StreamLimits
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
  // People who open the API's own address (a shared link, the GitHub page) land on the app.
  app.get('/', (_req, res) => res.redirect(302, env.WEB_ORIGIN[0] ?? '/health'))
  app.get('/api/config', (_req, res) => {
    const body: ConfigResponse = { demoMode: env.DEMO_MODE, version: container.version }
    res.json(body)
  })
  // Generous for people (mobile networks share one IP between many phones), fatal for scripts.
  app.use('/api', createRateLimit(options.requestsPerMinute ?? 600))
  const limit = createRateLimit(options.rateLimitPerMinute ?? 30)
  const streams = limitStreams(options.streamLimits ?? { perClient: 50, total: 2000 })
  app.use(
    '/api',
    shopRoutes({
      shops: container.shopService,
      payments: container.paymentService,
      events: container.paymentEvents,
      idempotency: container.idempotency,
      tabs: container.tabService,
      limit,
      streams,
    }),
  )
  app.use(
    '/api',
    tabRoutes({
      tabs: container.tabService,
      idempotency: container.idempotency,
      limit,
      webOrigin: env.WEB_ORIGIN[0] ?? 'http://localhost:5173',
    }),
  )
  app.use(
    '/api',
    paymentRoutes({
      payments: container.paymentService,
      events: container.paymentEvents,
      webOrigin: env.WEB_ORIGIN[0] ?? 'http://localhost:5173',
      streams,
    }),
  )

  app.use(notFound)
  app.use(errorHandler)
  return app
}
