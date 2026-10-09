// @vitest-environment happy-dom
import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FakeEventSource, payment, renderPage, SHOP, setUpPageTests } from '@/testing/fakes'
import { Component as ReceiptPage } from './ReceiptPage'

setUpPageTests()

const ID = payment().id

function openReceipt(query = '') {
  renderPage(ReceiptPage, { pattern: '/receipt/:paymentId', path: `/receipt/${ID}${query}` })
  const source = FakeEventSource.latest()
  act(() => source.open())
  return source
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent

describe('ReceiptPage', () => {
  it('follows the payment from approval to paid, then stops listening', () => {
    const source = openReceipt()
    expect(source.url).toBe(`/api/payments/${ID}/events`)
    expect(heading()).toBe('Checking the payment…')

    act(() => source.emit('payment', payment({ status: 'awaiting-consent' })))
    expect(heading()).toBe('Waiting for approval')
    expect(screen.getByRole('link', { name: 'Pay again' }).getAttribute('href')).toBe(
      `/shop/${SHOP.id}/pay`,
    )

    act(() => source.emit('payment', payment({ status: 'sending' })))
    expect(heading()).toBe('Confirming payment…')
    expect(screen.queryByRole('link', { name: 'Pay again' })).toBeNull()

    act(() =>
      source.emit(
        'payment',
        payment({ status: 'completed', completedAt: '2026-10-09T19:53:00.000Z' }),
      ),
    )
    expect(heading()).toBe('Paid')
    expect(document.body.textContent).toMatch(/Kasi Corner Spaza received COP\s50,00/)
    expect(document.body.textContent).toMatch(/You paid R\s0,27/)
    expect(source.readyState).toBe(FakeEventSource.CLOSED)
  })

  it('gives the reason when a payment fails', () => {
    const source = openReceipt()
    act(() => source.emit('payment', payment({ status: 'failed', failure: 'insufficient_funds' })))
    expect(heading()).toBe('Payment not completed')
    expect(document.body.textContent).toContain(
      "The wallet doesn't have enough money for this payment.",
    )
  })

  it('warns when the wallet approval could not be confirmed', () => {
    const source = openReceipt('?error=callback')
    act(() => source.emit('payment', payment({ status: 'awaiting-consent' })))
    expect(document.body.textContent).toContain("We couldn't confirm your approval yet.")
  })

  it('says so when the receipt does not exist', () => {
    const source = openReceipt()
    act(() => source.giveUp())
    expect(heading()).toBe("We couldn't find this receipt.")
  })
})
