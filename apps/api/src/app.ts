import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import type { Container } from './container'
import { errorHandler, notFound } from './http/errors'
import { CORRELATION_HEADER, requestLogger } from './http/request-logger'
import { healthRouter } from './http/routes/health'

// Payment requests are small JSON bodies; a low limit blunts abuse.
const BODY_LIMIT = '16kb'

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp(container: Container): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(requestLogger(container.logger))
  app.use(helmet())
  app.use(
    cors({
      origin: container.env.WEB_ORIGIN,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Idempotency-Key', CORRELATION_HEADER],
      exposedHeaders: [CORRELATION_HEADER],
      maxAge: 600,
    }),
  )
  app.use(express.json({ limit: BODY_LIMIT }))

  app.use(healthRouter(container.version))

  app.use(notFound)
  app.use(errorHandler)
  return app
}
