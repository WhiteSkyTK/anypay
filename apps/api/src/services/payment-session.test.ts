import { describe, expect, it } from 'vitest'
import { customerWallet, merchantWallet } from '../testing/fake-open-payments'
import {
  advance,
  assertStep,
  canTransition,
  fail,
  type PaymentSession,
  type PaymentStep,
} from './payment-session'

const session = (step: PaymentStep): PaymentSession => ({
  id: 'p-1',
  step,
  customer: customerWallet,
  merchant: merchantWallet,
  amount: { value: '100', assetCode: 'COP', assetScale: 2 },
})

describe('payment state machine', () => {
  it.each([
    ['created', 'incoming-payment-created'],
    ['incoming-payment-created', 'quoted'],
    ['quoted', 'awaiting-consent'],
    ['awaiting-consent', 'sending'],
    ['sending', 'completed'],
    ['awaiting-consent', 'failed'],
  ] as const)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  it.each([
    ['created', 'sending'],
    ['quoted', 'completed'],
    ['completed', 'failed'],
    ['failed', 'sending'],
    ['sending', 'quoted'],
  ] as const)('forbids %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
    expect(() => advance(session(from), to)).toThrow(/cannot become/)
  })

  it('advances immutably and records changes', () => {
    const before = session('created')
    const after = advance(before, 'incoming-payment-created', { description: 'bread' })
    expect(after).toMatchObject({
      step: 'incoming-payment-created',
      description: 'bread',
      id: 'p-1',
    })
    expect(before.step).toBe('created')
  })

  it('records why a payment failed', () => {
    expect(fail(session('sending'), 'insufficient_funds')).toMatchObject({
      step: 'failed',
      failure: 'insufficient_funds',
    })
  })

  it('checks the expected step', () => {
    expect(() => assertStep(session('quoted'), 'quoted')).not.toThrow()
    expect(() => assertStep(session('quoted'), 'sending')).toThrow(/Expected a sending payment/)
  })
})
