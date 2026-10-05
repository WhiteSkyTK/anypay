import type { HealthResponse } from '@anypay/shared'
import { Router } from 'express'

export function healthRouter(version: string): Router {
  const router = Router()
  router.get('/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok', version }
    res.set('Cache-Control', 'no-store').json(body)
  })
  return router
}
