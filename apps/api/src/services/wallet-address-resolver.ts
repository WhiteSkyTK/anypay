import { notImplemented } from '../lib/errors'

/**
 * Turns user input (`$host/name` or `https://host/name`) into a URL that is safe to fetch.
 *
 * Wallet addresses are user input, and the auth and resource server URLs they return are
 * untrusted too (SSRF risk). Every outbound URL passes through here: https only, no IP literals,
 * localhost or private ranges, and the host must be on ALLOWED_WALLET_HOSTS.
 *
 * Phase 1: implement, with the allowlist injected from env.
 */
export class WalletAddressResolver {
  /** Normalises and validates a wallet address entered by a merchant or carried in a QR code. */
  resolve(): Promise<never> {
    return notImplemented('WalletAddressResolver.resolve')
  }
}
