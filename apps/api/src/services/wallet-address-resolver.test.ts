import { describe, expect, it } from 'vitest'
import { AppError } from '../lib/errors'
import {
  ALLOWED_HOSTS,
  createFakeOpenPayments,
  customerWallet,
} from '../testing/fake-open-payments'
import { WalletAddressResolver } from './wallet-address-resolver'

const resolver = new WalletAddressResolver(createFakeOpenPayments(), ALLOWED_HOSTS)

function errorCode(run: () => unknown): string | undefined {
  try {
    run()
  } catch (error) {
    if (error instanceof AppError) return error.code
    throw error
  }
  return undefined
}

describe('normalise', () => {
  it.each([
    ['$ilp.interledger-test.dev/alice', 'https://ilp.interledger-test.dev/alice'],
    ['  $ilp.interledger-test.dev/alice  ', 'https://ilp.interledger-test.dev/alice'],
    ['https://ilp.interledger-test.dev/alice', 'https://ilp.interledger-test.dev/alice'],
    ['https://ilp.interledger-test.dev/alice/', 'https://ilp.interledger-test.dev/alice'],
    ['$ILP.Interledger-Test.dev/alice', 'https://ilp.interledger-test.dev/alice'],
    ['$ilp.interledger-test.dev', 'https://ilp.interledger-test.dev/.well-known/pay'],
  ])('%s → %s', (input, expected) => {
    expect(resolver.normalise(input)).toBe(expected)
  })
})

describe('SSRF protection', () => {
  it.each([
    // Clear-text protocols are the point of these cases: they must be rejected.
    'http://ilp.interledger-test.dev/alice', // eslint-disable-line sonarjs/no-clear-text-protocols
    'ftp://ilp.interledger-test.dev/alice', // eslint-disable-line sonarjs/no-clear-text-protocols
    'not a wallet address',
    'https://user:secret@ilp.interledger-test.dev/alice',
    'https://ilp.interledger-test.dev:8443/alice',
    'https://ilp.interledger-test.dev/alice?redirect=x',
    'https://ilp.interledger-test.dev/alice#frag',
  ])('rejects %s as invalid', (input) => {
    expect(errorCode(() => resolver.normalise(input))).toBe('wallet_address_invalid')
  })

  it.each([
    'https://127.0.0.1/alice',
    'https://10.0.0.5/alice',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/alice',
    'https://2130706433/alice',
    'https://0x7f000001/alice',
    'https://localhost/alice',
    'https://wallet.localhost/alice',
    'https://printer.local/alice',
    'https://intranet/alice',
    'https://example.com/alice',
    'https://evilinterledger-test.dev/alice',
    'https://interledger-test.dev.evil.example/alice',
  ])('rejects %s as not allowed', (input) => {
    expect(errorCode(() => resolver.normalise(input))).toBe('wallet_host_not_allowed')
  })

  it('allows the allowlisted domain and its subdomains', () => {
    expect(resolver.assertSafeUrl('https://interledger-test.dev/x').hostname).toBe(
      'interledger-test.dev',
    )
    expect(resolver.assertSafeUrl('https://auth.interledger-test.dev/t1').hostname).toBe(
      'auth.interledger-test.dev',
    )
  })
})

describe('resolve', () => {
  it('returns the wallet details for a payment pointer', async () => {
    await expect(resolver.resolve('$ilp.interledger-test.dev/southtest')).resolves.toEqual(
      customerWallet,
    )
  })

  it('refuses a wallet that points at an auth server off the allowlist', async () => {
    const openPayments = createFakeOpenPayments()
    openPayments.getWalletAddress.mockResolvedValueOnce({
      ...customerWallet,
      authServer: 'https://169.254.169.254/latest',
    })
    const strict = new WalletAddressResolver(openPayments, ALLOWED_HOSTS)
    await expect(strict.resolve(customerWallet.id)).rejects.toMatchObject({
      code: 'wallet_host_not_allowed',
    })
  })

  it('never calls out for an unsafe address', async () => {
    const openPayments = createFakeOpenPayments()
    const strict = new WalletAddressResolver(openPayments, ALLOWED_HOSTS)
    await expect(strict.resolve('https://localhost/alice')).rejects.toMatchObject({
      code: 'wallet_host_not_allowed',
    })
    expect(openPayments.getWalletAddress).not.toHaveBeenCalled()
  })
})
