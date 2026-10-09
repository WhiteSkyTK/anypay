import { describe, expect, it } from 'vitest'
import { readNameInput, walletAddress, walletName } from './wallet-address'

const HOST = 'ilp.interledger-test.dev'

describe('walletName', () => {
  it.each([
    ['', ''],
    ['$ilp.interledger-test.dev/merchanttest', 'merchanttest'],
    ['https://ilp.interledger-test.dev/southtest', 'southtest'],
    ['  $ILP.interledger-test.dev/889920ca ', '889920ca'],
  ])('finds the name in %j', (address, name) => {
    expect(walletName(address, HOST)).toBe(name)
  })

  it.each([
    '$wallet.other-provider.example/alice',
    'https://ilp.interledger-test.dev.evil.example/alice',
    'ilp.interledger-test.dev/no-scheme',
  ])('returns null for %j, so the full address is shown', (address) => {
    expect(walletName(address, HOST)).toBeNull()
  })
})

describe('walletAddress', () => {
  it('builds the $ form, and keeps empty empty so "required" still shows', () => {
    expect(walletAddress('merchanttest', HOST)).toBe('$ilp.interledger-test.dev/merchanttest')
    expect(walletAddress('', HOST)).toBe('')
  })
})

describe('readNameInput', () => {
  it.each([
    ['merchanttest', 'merchanttest'],
    [' merchant test ', 'merchanttest'],
    ['$ilp.interledger-test.dev/merchanttest', 'merchanttest'],
    ['https://ilp.interledger-test.dev/merchanttest', 'merchanttest'],
    ['ilp.interledger-test.dev/merchanttest', 'merchanttest'],
  ])('keeps the name from %j', (input, name) => {
    expect(readNameInput(input, HOST)).toEqual({ name })
  })

  it.each([
    ['$', '$'],
    ['https://wallet.other.example/alice', 'https://wallet.other.example/alice'],
    ['wallet.other.example/alice', '$wallet.other.example/alice'],
  ])('switches to a full address for %j', (input, address) => {
    expect(readNameInput(input, HOST)).toEqual({ address })
  })
})
