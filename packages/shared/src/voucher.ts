/**
 * Offline voucher protocol (CLAUDE.md, Feature 4). Shared so the shop's phone (offline) and the
 * server (on sync) check vouchers with the same code. WebCrypto only (browsers and Node 22 both
 * have crypto.subtle), and ECDSA signatures in the raw P1363 form that both produce and expect.
 *
 * 1. The shop shows a sale request:   /t/<shopId>/<amount>/<nonce>/<ts>
 * 2. The customer's phone signs        v1|<tabId>|<shopId>|<amount>|<nonce>|<ts>
 *    and shows the voucher:           /v/<tabId>/<shopId>/<amount>/<nonce>/<ts>/<signature>
 * Both are paths on the AnyPay web app, so a phone's own camera app opens them too.
 */
import { fromBase64url, randomBase64url, toBase64url } from './base64url'

export const VOUCHER_VERSION = 'v1'
/** A voucher must reach the server within 72 hours (CLAUDE.md). */
export const VOUCHER_MAX_AGE_MS = 72 * 60 * 60 * 1000
/** Phones' clocks drift: a voucher may come from up to 10 minutes in the future. */
export const VOUCHER_MAX_CLOCK_SKEW_MS = 10 * 60 * 1000

const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' } as const

/** The JWK fields of a P-256 public key: all that is stored with a tab and sent to the shop. */
export interface PublicKeyJwk {
  kty?: string
  crv?: string
  x?: string
  y?: string
}

export interface DeviceKeys {
  publicKey: CryptoKey
  privateKey: CryptoKey
}
const SIGNING = { name: 'ECDSA', hash: 'SHA-256' } as const

/** What the shop asks for, offline: an amount in the shop's minor units, once (nonce). */
export interface SaleRequest {
  shopId: string
  /** Minor units of the shop's currency, e.g. '2500' for COP 25,00. */
  amount: string
  /** Random, single use: the server settles a nonce at most once, whichever phone sends it. */
  nonce: string
  /** When the request was made, in Unix seconds. */
  ts: number
}

/** The customer's signed approval of one sale on their tab. */
export interface Voucher extends SaleRequest {
  tabId: string
  /** ECDSA P-256 / SHA-256 over `voucherMessage`, raw (P1363) 64 bytes, base64url. */
  signature: string
}

const FIELD = {
  id: /^[\w-]{1,32}$/,
  amount: /^[1-9]\d{0,17}$/,
  nonce: /^[\w-]{12,32}$/,
  ts: /^\d{9,11}$/,
  signature: /^[\w-]{86}$/,
}

/** The exact string the customer's key signs. Field order and format are part of the protocol. */
export function voucherMessage(voucher: Omit<Voucher, 'signature'>): string {
  const { tabId, shopId, amount, nonce, ts } = voucher
  return [VOUCHER_VERSION, tabId, shopId, amount, nonce, ts].join('|')
}

export const saleRequestPath = ({ shopId, amount, nonce, ts }: SaleRequest) =>
  `/t/${shopId}/${amount}/${nonce}/${ts}`

export const voucherPath = ({ tabId, shopId, amount, nonce, ts, signature }: Voucher) =>
  `/v/${tabId}/${shopId}/${amount}/${nonce}/${ts}/${signature}`

/** The path of a scanned link or a pasted URL, without the origin. */
function pathOf(input: string): string {
  try {
    return new URL(input.trim(), 'https://anypay.invalid').pathname
  } catch {
    return ''
  }
}

/** Reads a sale request from a scanned link; null if it isn't a valid one. */
export function parseSaleRequest(input: string): SaleRequest | null {
  const [, kind, shopId = '', amount = '', nonce = '', ts = '', ...rest] = pathOf(input).split('/')
  if (kind !== 't' || rest.length > 0) return null
  const valid =
    FIELD.id.test(shopId) &&
    FIELD.amount.test(amount) &&
    FIELD.nonce.test(nonce) &&
    FIELD.ts.test(ts)
  return valid ? { shopId, amount, nonce, ts: Number(ts) } : null
}

/** Reads a voucher from a scanned link; null if it isn't a well-formed one (not yet verified). */
export function parseVoucher(input: string): Voucher | null {
  const parts = pathOf(input).split('/')
  const [, kind, tabId = '', shopId = '', amount = '', nonce = '', ts = '', signature = ''] = parts
  if (kind !== 'v' || parts.length !== 8) return null
  const request = parseSaleRequest(`/t/${shopId}/${amount}/${nonce}/${ts}`)
  if (!request || !FIELD.id.test(tabId) || !FIELD.signature.test(signature)) return null
  return { ...request, tabId, signature }
}

/** A fresh random nonce: 12 base64url characters (72 bits). */
export function newNonce(): string {
  return randomBase64url(9)
}

/** Too old to settle, or from too far in the future to trust. */
export function isFresh(ts: number, now = Date.now()): boolean {
  const age = now - ts * 1000
  return age <= VOUCHER_MAX_AGE_MS && -age <= VOUCHER_MAX_CLOCK_SKEW_MS
}

/**
 * The customer's device key. The private half can't be exported (it never leaves the phone);
 * only the public half is registered with the tab.
 */
export async function generateDeviceKeys(): Promise<DeviceKeys> {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(ECDSA, false, [
    'sign',
    'verify',
  ])
  return { publicKey, privateKey }
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<PublicKeyJwk> {
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', publicKey)
  return { kty, crv, x, y }
}

export async function signVoucher(
  privateKey: CryptoKey,
  fields: Omit<Voucher, 'signature'>,
): Promise<Voucher> {
  const message = new TextEncoder().encode(voucherMessage(fields))
  const signature = await crypto.subtle.sign(SIGNING, privateKey, message)
  return { ...fields, signature: toBase64url(new Uint8Array(signature)) }
}

/** True only for a voucher signed by the key behind `publicKey`; malformed input is just false. */
export async function verifyVoucher(publicKey: PublicKeyJwk, voucher: Voucher): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('jwk', publicKey, ECDSA, false, ['verify'])
    const message = new TextEncoder().encode(voucherMessage(voucher))
    return await crypto.subtle.verify(SIGNING, key, fromBase64url(voucher.signature), message)
  } catch {
    return false
  }
}
