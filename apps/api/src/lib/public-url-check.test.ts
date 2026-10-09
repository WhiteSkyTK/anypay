import { pino } from 'pino'
import { describe, expect, it, vi } from 'vitest'
import { checkPublicUrl } from './public-url-check'

/** A logger whose JSON lines the test can read. */
function captureLogs() {
  const lines: Record<string, unknown>[] = []
  const logger = pino({ level: 'info' }, { write: (line: string) => lines.push(JSON.parse(line)) })
  return { logger, lines }
}

describe('checkPublicUrl', () => {
  it('passes when the public address answers /health', async () => {
    const fetchFn = vi.fn(async () => new Response('{"status":"ok"}'))
    const { logger } = captureLogs()
    await expect(
      checkPublicUrl('https://anypay-api.onrender.com', logger, { fetchFn }),
    ).resolves.toBe(true)
    expect(fetchFn).toHaveBeenCalledWith(
      'https://anypay-api.onrender.com/health',
      expect.anything(),
    )
  })

  it('retries, then warns when the address never answers (e.g. a typo in the host)', async () => {
    const fetchFn = vi.fn(async (): Promise<Response> => {
      throw new TypeError('getaddrinfo ENOTFOUND anypay-api.onrender')
    })
    const { logger, lines } = captureLogs()
    await expect(
      checkPublicUrl('https://anypay-api.onrender', logger, { fetchFn, attempts: 2, delayMs: 1 }),
    ).resolves.toBe(false)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(lines.at(-1)).toMatchObject({ level: 40, publicApiUrl: 'https://anypay-api.onrender' })
  })

  it('treats an error status as not reaching the API', async () => {
    const fetchFn = vi.fn(async () => new Response('Not found', { status: 404 }))
    const { logger } = captureLogs()
    await expect(
      checkPublicUrl('https://example.org', logger, { fetchFn, attempts: 1 }),
    ).resolves.toBe(false)
  })
})
