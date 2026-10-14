import { describe, expect, it } from 'vitest'
import {
  exportPublicKey,
  generateDeviceKeys,
  isFresh,
  newNonce,
  parseSaleRequest,
  parseVoucher,
  saleRequestPath,
  signVoucher,
  verifyVoucher,
  type Voucher,
  voucherMessage,
  voucherPath,
  VOUCHER_MAX_AGE_MS,
} from './voucher'

const request = { shopId: '7KQM4XPA', amount: '2500', nonce: 'k3J9xQ2mT8aZ', ts: 1_792_000_000 }
const unsigned = { ...request, tabId: 'tab_4fX9qL2pM7' }

async function signed() {
  const keys = await generateDeviceKeys()
  const voucher = await signVoucher(keys.privateKey, unsigned)
  return { keys, voucher, publicJwk: await exportPublicKey(keys.publicKey) }
}

describe('voucher message', () => {
  it('is exactly v1|tabId|shopId|amount|nonce|ts', () => {
    expect(voucherMessage(unsigned)).toBe('v1|tab_4fX9qL2pM7|7KQM4XPA|2500|k3J9xQ2mT8aZ|1792000000')
  })
})

describe('signing and verifying', () => {
  it('accepts a voucher signed by the tab’s device key', async () => {
    const { voucher, publicJwk } = await signed()
    expect(voucher.signature).toMatch(/^[\w-]{86}$/) // 64-byte P1363, like browsers make
    await expect(verifyVoucher(publicJwk, voucher)).resolves.toBe(true)
  })

  it.each([
    ['a tampered amount', { amount: '25000' }],
    ['another shop', { shopId: 'OTHERSHP' }],
    ['another tab', { tabId: 'tab_someoneElse' }],
    ['a reused signature with a new nonce', { nonce: 'aaaaaaaaaaaa' }],
    ['a changed time', { ts: 1_792_000_001 }],
  ])('refuses %s', async (_label, change) => {
    const { voucher, publicJwk } = await signed()
    await expect(verifyVoucher(publicJwk, { ...voucher, ...change })).resolves.toBe(false)
  })

  it('refuses a voucher signed by another phone', async () => {
    const { voucher } = await signed()
    const other = await generateDeviceKeys()
    await expect(verifyVoucher(await exportPublicKey(other.publicKey), voucher)).resolves.toBe(
      false,
    )
  })

  it('treats a broken key or signature as not valid, not as an error', async () => {
    const { voucher, publicJwk } = await signed()
    await expect(verifyVoucher({ kty: 'EC' }, voucher)).resolves.toBe(false)
    await expect(verifyVoucher(publicJwk, { ...voucher, signature: 'A'.repeat(86) })).resolves.toBe(
      false,
    )
  })

  it('keeps the private key on the phone (not exportable)', async () => {
    const { keys } = await signed()
    expect(keys.privateKey.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('jwk', keys.privateKey)).rejects.toThrow()
  })
})

describe('links', () => {
  it('round-trips a sale request and a voucher through their links, with or without the origin', async () => {
    const { voucher } = await signed()
    expect(parseSaleRequest(saleRequestPath(request))).toEqual(request)
    expect(parseSaleRequest(`https://anypay-web.onrender.com${saleRequestPath(request)}`)).toEqual(
      request,
    )
    expect(parseVoucher(`https://anypay-web.onrender.com${voucherPath(voucher)}`)).toEqual(voucher)
  })

  it.each([
    '/t/7KQM4XPA/0/k3J9xQ2mT8aZ/1792000000', // zero amount
    '/t/7KQM4XPA/-5/k3J9xQ2mT8aZ/1792000000',
    '/t/7KQM4XPA/25.00/k3J9xQ2mT8aZ/1792000000', // minor units only
    '/t/7KQM4XPA/2500/short/1792000000',
    '/t/7KQM4XPA/2500/k3J9xQ2mT8aZ/1792000000/extra',
    '/shop/7KQM4XPA/pay',
    'not a link',
  ])('rejects %j as a sale request', (input) => {
    expect(parseSaleRequest(input)).toBeNull()
  })

  it('rejects a voucher link with a malformed signature', async () => {
    const { voucher } = await signed()
    const broken: Voucher = { ...voucher, signature: 'abc' }
    expect(parseVoucher(voucherPath(broken))).toBeNull()
  })
})

describe('freshness and nonces', () => {
  const now = 1_792_000_000_000

  it('accepts vouchers up to 72 hours old and a little from the future (clock drift)', () => {
    expect(isFresh(now / 1000, now)).toBe(true)
    expect(isFresh((now - VOUCHER_MAX_AGE_MS) / 1000, now)).toBe(true)
    expect(isFresh((now + 5 * 60_000) / 1000, now)).toBe(true)
  })

  it('refuses older vouchers and ones from far in the future', () => {
    expect(isFresh((now - VOUCHER_MAX_AGE_MS - 1000) / 1000, now)).toBe(false)
    expect(isFresh((now + 60 * 60_000) / 1000, now)).toBe(false)
  })

  it('makes unguessable, link-safe nonces', () => {
    const nonces = new Set(Array.from({ length: 100 }, newNonce))
    expect(nonces.size).toBe(100)
    for (const nonce of nonces) expect(nonce).toMatch(/^[\w-]{12}$/)
  })
})
