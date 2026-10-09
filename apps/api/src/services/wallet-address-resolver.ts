import { isIP } from 'node:net'
import { AppError } from '../lib/errors'
import type { OpenPaymentsPort } from '../open-payments/port'
import type { WalletAddressInfo } from '../open-payments/types'

const invalid = (message: string) => new AppError('wallet_address_invalid', message, 400)
const notAllowed = (host: string) =>
  new AppError('wallet_host_not_allowed', `Wallets on ${host} are not supported`, 400)

const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa']

function isLocalName(host: string): boolean {
  return host === 'localhost' || !host.includes('.') || LOCAL_SUFFIXES.some((s) => host.endsWith(s))
}

/**
 * Turns user input (`$host/name` or `https://host/name`) into a URL that is safe to fetch.
 *
 * Wallet addresses are user input, and the auth and resource server URLs a wallet returns are
 * untrusted too (SSRF risk), so every one of them passes the same checks: https only, no
 * credentials or custom ports, no IP literals or local names, and the host (or a parent domain)
 * must be on ALLOWED_WALLET_HOSTS.
 */
export class WalletAddressResolver {
  readonly #openPayments: Pick<OpenPaymentsPort, 'getWalletAddress'>
  readonly #allowedHosts: readonly string[]

  constructor(
    openPayments: Pick<OpenPaymentsPort, 'getWalletAddress'>,
    allowedHosts: readonly string[],
  ) {
    this.#openPayments = openPayments
    this.#allowedHosts = allowedHosts.map((host) => host.toLowerCase())
  }

  /** Resolves a wallet address to its auth server, resource server and asset (step 1). */
  async resolve(input: string): Promise<WalletAddressInfo> {
    const wallet = await this.#openPayments.getWalletAddress(this.normalise(input))
    this.assertSafeUrl(wallet.authServer)
    this.assertSafeUrl(wallet.resourceServer)
    return wallet
  }

  /** `$ilp.interledger-test.dev/alice` → `https://ilp.interledger-test.dev/alice`. */
  normalise(input: string): string {
    const trimmed = input.trim()
    const url = this.assertSafeUrl(
      trimmed.startsWith('$') ? `https://${trimmed.slice(1)}` : trimmed,
    )
    // Payment pointer convention: a bare host means its well-known payment path.
    if (url.pathname === '/') url.pathname = '/.well-known/pay'
    return url.href.replace(/\/$/, '')
  }

  /** Throws unless the URL passes every SSRF check; returns it parsed. */
  assertSafeUrl(value: string): URL {
    let url: URL
    try {
      url = new URL(value)
    } catch {
      throw invalid('Not a valid wallet address')
    }
    if (url.protocol !== 'https:') throw invalid('Wallet addresses must use https')
    if (url.username || url.password || url.port || url.search || url.hash) {
      throw invalid('Wallet addresses cannot contain credentials, ports, queries or fragments')
    }
    // The URL parser turns decimal or hex IPs (e.g. 2130706433) into dotted form, so isIP sees them.
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host) !== 0 || isLocalName(host)) throw notAllowed(host)
    if (!this.#isAllowedHost(host)) throw notAllowed(host)
    return url
  }

  #isAllowedHost(host: string): boolean {
    return this.#allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  }
}
