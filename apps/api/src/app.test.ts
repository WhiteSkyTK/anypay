import { ApiErrorSchema, HealthResponseSchema } from '@anypay/shared'
import express from 'express'
import request from 'supertest'
import type { Express } from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { parseEnv } from './config/env'
import { createContainer } from './container'
import { errorHandler } from './http/errors'
import { requestLogger } from './http/request-logger'
import { NotImplementedError } from './lib/errors'
import type { DatabaseHandle } from './db/database'
import { createFakeOpenPayments } from './testing/fake-open-payments'
import { openTestDatabase } from './testing/test-database'

const WEB_ORIGIN = 'https://anypay.example'
let database: DatabaseHandle
let container: ReturnType<typeof createContainer>
let app: Express

beforeAll(async () => {
  database = await openTestDatabase()
  container = createContainer(parseEnv({ NODE_ENV: 'test', WEB_ORIGIN }), database.db, {
    openPayments: createFakeOpenPayments(),
  })
  app = createApp(container)
})
afterAll(() => database.close())

describe('GET /health', () => {
  it('returns 200 with the shared health shape', async () => {
    const res = await request(app).get('/health').expect(200)
    expect(HealthResponseSchema.parse(res.body)).toEqual({ status: 'ok', version: '0.1.0' })
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})

describe('correlation id', () => {
  it('generates one when the caller sends none', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-correlation-id']).toMatch(/^[\w-]{8,64}$/)
  })

  it('reuses a safe id from the caller', async () => {
    const res = await request(app).get('/health').set('X-Correlation-Id', 'phone-abc-123')
    expect(res.headers['x-correlation-id']).toBe('phone-abc-123')
  })

  it.each(['<script>forged</script>', `forged-${'x'.repeat(100)}`])(
    'replaces an unsafe id: %s',
    async (unsafe) => {
      const res = await request(app).get('/health').set('X-Correlation-Id', unsafe)
      expect(res.headers['x-correlation-id']).not.toContain('forged')
    },
  )
})

describe('CORS', () => {
  it('allows the configured web origin', async () => {
    const res = await request(app).get('/health').set('Origin', WEB_ORIGIN)
    expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN)
  })

  it('does not allow other origins', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('errors', () => {
  it('returns a JSON 404 with a correlation id for unknown routes', async () => {
    const res = await request(app).get('/nope').expect(404)
    const body = ApiErrorSchema.parse(res.body)
    expect(body.error.code).toBe('not_found')
    expect(body.correlationId).toBe(res.headers['x-correlation-id'])
  })

  it('rejects malformed JSON with a clear code', async () => {
    const res = await request(app)
      .post('/anything')
      .set('Content-Type', 'application/json')
      .send('{"amount": ')
      .expect(400)
    expect(res.body.error.code).toBe('invalid_json')
  })

  it('rejects bodies over the 16 KB limit', async () => {
    const res = await request(app)
      .post('/anything')
      .send({ note: 'x'.repeat(17 * 1024) })
      .expect(413)
    expect(res.body.error.code).toBe('payload_too_large')
  })

  it('maps known app errors and hides unknown ones', async () => {
    const probe = express()
    probe.use(requestLogger(container.logger))
    probe.get('/stub', () => {
      throw new NotImplementedError('Stub')
    })
    probe.get('/crash', () => {
      throw new Error('getaddrinfo ENOTFOUND db.internal.anypay')
    })
    probe.use(errorHandler)

    const stub = await request(probe).get('/stub').expect(501)
    expect(stub.body.error.code).toBe('not_implemented')

    const crash = await request(probe).get('/crash').expect(500)
    expect(crash.body.error).toEqual({ code: 'internal_error', message: 'Something went wrong' })
    expect(JSON.stringify(crash.body)).not.toContain('db.internal')
  })
})
