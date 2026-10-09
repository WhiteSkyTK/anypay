// @vitest-environment happy-dom
import type { PaymentSummary, Quote } from '@anypay/shared'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { initI18n } from '@/i18n'
import { Keypad } from './Keypad'
import { PaymentRow } from './PaymentRow'
import { QuoteSheet } from './QuoteSheet'
import { StatusChip } from './StatusChip'

const cop = (value: string) => ({ value, assetCode: 'COP', assetScale: 2 })
const zar = (value: string) => ({ value, assetCode: 'ZAR', assetScale: 2 })

function payment(overrides: Partial<PaymentSummary> = {}): PaymentSummary {
  return {
    id: '70125f46-5c8b-48f5-afea-0b345a6468ad',
    shopId: 't8twHh2K',
    shopName: 'Kasi Corner Spaza',
    status: 'completed',
    amount: cop('5000'),
    debitAmount: zar('27'),
    createdAt: '2026-10-09T19:52:00.000Z',
    completedAt: '2026-10-09T19:53:00.000Z',
    ...overrides,
  }
}

beforeAll(async () => {
  await initI18n()
})

afterEach(() => {
  cleanup()
})

describe('Keypad', () => {
  it('sends each key, including delete, to its handler', async () => {
    const onKey = vi.fn()
    render(<Keypad onKey={onKey} decimals={2} />)
    const keypad = screen.getByRole('group', { name: 'Amount keypad' })
    await userEvent.click(within(keypad).getByRole('button', { name: '7' }))
    await userEvent.click(within(keypad).getByRole('button', { name: 'Decimal comma' }))
    await userEvent.click(within(keypad).getByRole('button', { name: 'Delete' }))
    expect(onKey.mock.calls).toEqual([['7'], [','], ['back']])
  })

  it('hides the comma for a currency without cents', () => {
    render(<Keypad onKey={vi.fn()} decimals={0} />)
    expect(screen.queryByRole('button', { name: 'Decimal comma' })).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(11)
  })
})

describe('StatusChip', () => {
  it.each([
    ['completed', 'Received'],
    ['failed', 'Failed'],
    ['awaiting-consent', 'Waiting'],
  ] as const)('labels %s in words, not colour alone', (status, label) => {
    render(<StatusChip status={status} />)
    expect(screen.getByText(label)).toBeTruthy()
  })
})

describe('PaymentRow', () => {
  it('shows what the shop received and what the customer paid in their own currency', () => {
    render(
      <ul>
        <PaymentRow payment={payment()} />
      </ul>,
    )
    const row = screen.getByRole('listitem')
    expect(row.textContent).toContain('Received')
    expect(row.textContent).toMatch(/COP\s50,00/)
    expect(row.textContent).toMatch(/Customer paid R\s0,27/)
  })

  it('does not claim a customer amount before the payment completes', () => {
    render(
      <ul>
        <PaymentRow payment={payment({ status: 'awaiting-consent', completedAt: undefined })} />
      </ul>,
    )
    expect(screen.getByRole('listitem').textContent).not.toContain('Customer paid')
  })
})

describe('QuoteSheet', () => {
  const quote: Quote = {
    debitAmount: zar('27'),
    receiveAmount: cop('5000'),
    expiresAt: '2026-10-09T19:57:00.000Z',
  }

  function renderSheet(redirecting = false) {
    const onApprove = vi.fn()
    const onCancel = vi.fn()
    render(
      <QuoteSheet
        open
        shopName="Kasi Corner Spaza"
        quote={quote}
        redirecting={redirecting}
        onApprove={onApprove}
        onCancel={onCancel}
      />,
    )
    return { onApprove, onCancel, sheet: screen.getByRole('dialog', { name: 'Confirm payment' }) }
  }

  it('shows the exact debit next to what the shop receives', () => {
    const { sheet } = renderSheet()
    expect(sheet.textContent).toMatch(/You pay\s*R\s0,27/)
    expect(sheet.textContent).toMatch(/Kasi Corner Spaza gets\s*COP\s50,00/)
  })

  it('approves or cancels', async () => {
    const { onApprove, onCancel, sheet } = renderSheet()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Approve in my wallet' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    expect(onApprove).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('locks both buttons while the wallet opens', () => {
    const { sheet } = renderSheet(true)
    const buttons = within(sheet).getAllByRole('button') as HTMLButtonElement[]
    expect(buttons.map((button) => button.disabled)).toEqual([true, true])
    expect(sheet.textContent).toContain('Opening your wallet')
  })
})
