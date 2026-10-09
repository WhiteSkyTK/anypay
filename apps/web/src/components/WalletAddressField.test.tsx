// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '@/i18n'
import { WalletAddressField } from './WalletAddressField'

function Harness({ initial = '', error }: Readonly<{ initial?: string; error?: string }>) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <WalletAddressField
        label="Your wallet address"
        hint="Saved on this phone for next time."
        value={value}
        onChange={setValue}
        error={error}
      />
      <output data-testid="value">{value}</output>
    </>
  )
}

const sent = () => screen.getByTestId('value').textContent
const input = () => screen.getByLabelText('Your wallet address') as HTMLInputElement

beforeAll(async () => {
  await initI18n()
})

afterEach(() => {
  cleanup()
})

describe('WalletAddressField', () => {
  it('asks only for the name and shows the rest of the address', async () => {
    render(<Harness />)
    expect(screen.getByText('$ilp.interledger-test.dev/')).toBeTruthy()
    await userEvent.type(input(), 'merchanttest')
    expect(sent()).toBe('$ilp.interledger-test.dev/merchanttest')
    expect(input().getAttribute('aria-describedby')).toMatch(/prefix/)
    expect(document.body.textContent).toContain(
      'Just your wallet name: the part after the slash. Saved on this phone for next time.',
    )
  })

  it('cuts a pasted full address down to the name', async () => {
    render(<Harness />)
    input().focus()
    await userEvent.paste('https://ilp.interledger-test.dev/southtest')
    expect(input().value).toBe('southtest')
    expect(sent()).toBe('$ilp.interledger-test.dev/southtest')
  })

  it('keeps typing going when someone types a whole address', async () => {
    render(<Harness />)
    await userEvent.type(input(), '$wallet.other.example/alice')
    expect(sent()).toBe('$wallet.other.example/alice')
    expect(document.activeElement).toBe(input())
    expect(screen.queryByText('$ilp.interledger-test.dev/')).toBeNull()
  })

  it('switches to another provider and back, keeping focus in the field', async () => {
    render(<Harness initial="$ilp.interledger-test.dev/southtest" />)
    expect(input().value).toBe('southtest')

    await userEvent.click(screen.getByRole('button', { name: 'Wallet from another provider?' }))
    expect(input().value).toBe('$ilp.interledger-test.dev/southtest')
    expect(document.activeElement).toBe(input())
    expect(document.body.textContent).toContain('It starts with $ or https://.')

    await userEvent.click(
      screen.getByRole('button', { name: 'Use a ilp.interledger-test.dev wallet' }),
    )
    expect(input().value).toBe('southtest')
    expect(document.activeElement).toBe(input())
  })

  it('opens on the full address for a wallet from another provider', () => {
    render(<Harness initial="$wallet.other.example/alice" />)
    expect(input().value).toBe('$wallet.other.example/alice')
  })

  it('marks the field invalid with the error', () => {
    render(<Harness error="There's no wallet at that address." />)
    expect(input().getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert').textContent).toBe("There's no wallet at that address.")
  })
})
