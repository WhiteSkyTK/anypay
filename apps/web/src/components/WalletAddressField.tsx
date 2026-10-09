import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { DEFAULT_WALLET_HOST, readNameInput, walletAddress, walletName } from '@/lib/wallet-address'

interface WalletAddressFieldProps {
  label: string
  /** The full address, e.g. `$ilp.interledger-test.dev/merchanttest`. */
  value: string
  onChange: (address: string) => void
  /** Extra hint after the field's own, e.g. "Saved on this phone". */
  hint?: string
  /** Translated error text; also marks the input invalid for screen readers. */
  error?: string
  className?: string
  disabled?: boolean
}

const box =
  'min-h-12 w-full rounded-2xl border-2 border-input bg-card px-4 text-base text-card-foreground'

/**
 * A wallet address in the fewest keystrokes: on the usual provider only the name after the slash
 * is typed, with the rest shown as a fixed prefix. Pasting a whole address works too. One tap
 * switches to a full address for any other Open Payments wallet.
 */
export function WalletAddressField({
  label,
  value,
  onChange,
  hint,
  error,
  className,
  disabled,
}: Readonly<WalletAddressFieldProps>) {
  const { t } = useTranslation()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const name = walletName(value)
  const [full, setFull] = useState(name === null)
  const prefix = `$${DEFAULT_WALLET_HOST}/`
  const ids = { prefix: `${id}-prefix`, hint: `${id}-hint`, error: `${id}-error` }
  const fieldHint = [full ? t('wallet.fullHint') : t('wallet.nameHint'), hint]
    .filter(Boolean)
    .join(' ')
  const describedBy = [!full && ids.prefix, ids.hint, error && ids.error].filter(Boolean).join(' ')

  function switchMode() {
    // flushSync renders the other input first, so focus lands where the customer types next.
    flushSync(() => {
      if (!full) return setFull(true)
      setFull(false)
      onChange(walletAddress(name ?? ''))
    })
    inputRef.current?.focus()
  }

  function typeName(input: string) {
    const read = readNameInput(input)
    if ('name' in read) return onChange(walletAddress(read.name))
    setFull(true) // a whole address from another provider was pasted
    onChange(read.address)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {/* One input in both modes, so typing "$" (switching to a full address) keeps the caret.
          The prefix wraps above the name at large text sizes instead of squeezing it. */}
      <div
        className={cn(
          box,
          'flex flex-wrap items-center focus-within:outline-[0.1875rem] focus-within:outline-offset-2 focus-within:outline-ring focus-within:outline-solid',
          error && 'border-destructive',
        )}
      >
        {!full && (
          <span id={ids.prefix} className="py-3 text-muted-foreground select-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          ref={inputRef}
          disabled={disabled}
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          value={full ? value : (name ?? '')}
          onChange={(event) => (full ? onChange(event.target.value) : typeName(event.target.value))}
          placeholder={full ? `${prefix}yourname` : t('wallet.namePlaceholder')}
          className="min-h-11 min-w-[8ch] flex-1 bg-transparent placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <p id={ids.hint} className="text-sm text-muted-foreground">
        {fieldHint}
      </p>
      {error && (
        <p id={ids.error} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={switchMode}
        disabled={disabled}
        className="min-h-12 self-start text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        {full ? t('wallet.useDefault', { host: DEFAULT_WALLET_HOST }) : t('wallet.otherProvider')}
      </button>
    </div>
  )
}
