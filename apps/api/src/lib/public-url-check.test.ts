import { pino } from 'pino'
import { describe, expect, it, vi } from 'vitest'
import { checkPublicUrl, strandedPhonesWarning } from './public-url-check'

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

// Wi-Fi testing runs on plain http on the local network; that is exactly the case under test.
/* eslint-disable sonarjs/no-clear-text-protocols */
describe('strandedPhonesWarning', () => {
  it('warns when phones use the PC address but wallets would send them to localhost', () => {
    const warning = strandedPhonesWarning('http://10.0.0.4:5173', 'http://localhost:3000')
    expect(warning).toContain('Set PUBLIC_API_URL=http://10.0.0.4:5173')
  })

  it.each([
    ['http://localhost:5173', 'http://localhost:3000'],
    ['http://10.0.0.4:5173', 'http://10.0.0.4:5173'],
    ['https://anypay-web.onrender.com', 'https://anypay-api.onrender.com'],
  ])('is quiet for %s with %s', (web, api) => {
    expect(strandedPhonesWarning(web, api)).toBeNull()
  })
})
