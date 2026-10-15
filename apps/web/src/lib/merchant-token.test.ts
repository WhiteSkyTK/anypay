// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiError, fakeApi, SESSION } from '@/testing/fakes'
import { getMerchantSession, setMerchantSession } from './merchant-session'
import { signInLink, signOutOtherPhones } from './merchant-token'

const PUT = `PUT /api/shops/${SESSION.shopId}/merchant-token`
const bearer = (headers: Record<string, string>) => headers.Authorization?.replace('Bearer ', '')

afterEach(() => {
  vi.unstubAllGlobals()
  setMerchantSession(null)
  localStorage.clear()
})

describe('signInLink', () => {
  it('carries the token in the fragment, which browsers never send to a server', () => {
    const link = new URL(signInLink(SESSION, 'https://anypay.example'))
    expect(link.pathname).toBe('/merchant/connect')
    expect(link.search).toBe('')
    expect(new URLSearchParams(link.hash.slice(1)).get('token')).toBe(SESSION.token)
  })
})

describe('signOutOtherPhones', () => {
  it('switches this phone to a fresh 32-byte token of its own', async () => {
    const calls = fakeApi({ [PUT]: { status: 200 } })
    setMerchantSession(SESSION)
    const signedIn = await signOutOtherPhones(SESSION)
    expect(signedIn.token).toMatch(/^[\w-]{43}$/)
    expect(signedIn.token).not.toBe(SESSION.token)
    expect(bearer(calls[0]?.headers ?? {})).toBe(SESSION.token)
    expect(calls[0]?.body).toEqual({ token: signedIn.token })
    expect(getMerchantSession()).toEqual(signedIn)
  })

  it('finishes a change whose answer was lost, instead of locking the phone out', async () => {
    const next = 'n'.repeat(43)
    // The server already switched to `next`: the old token is refused, the new one accepted.
    fakeApi({
      [PUT]: ({ headers }) =>
        bearer(headers) === next ? { status: 200 } : apiError(401, 'merchant_unauthorized'),
    })
    const pending = { ...SESSION, nextToken: next }
    setMerchantSession(pending)
    expect((await signOutOtherPhones(pending)).token).toBe(next)
    expect(getMerchantSession()?.nextToken).toBeUndefined()
  })

  it('keeps the old token and the pending one when there is no connection', async () => {
    fakeApi({ [PUT]: { networkError: true } })
    setMerchantSession(SESSION)
    await expect(signOutOtherPhones(SESSION)).rejects.toMatchObject({ code: 'network_error' })
    const session = getMerchantSession()
    expect(session?.token).toBe(SESSION.token)
    expect(session?.nextToken).toMatch(/^[\w-]{43}$/)
  })
})
