import { Delete } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { KeypadKey } from '@/lib/keypad'

const KEYS: readonly KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back']

interface KeypadProps {
  onKey: (key: KeypadKey) => void
  /** Hides the decimal key for currencies without cents. */
  decimals: number
  disabled?: boolean
}

/**
 * A big custom keypad: a spaza queue moves fast, and the phone's own keyboard is small, hides half
 * the screen and differs per phone. Keys are 4rem tall for thumbs.
 */
export function Keypad({ onKey, decimals, disabled = false }: Readonly<KeypadProps>) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={t('pay.keypad.label')} className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => {
        if (key === ',' && decimals === 0) return <span key={key} aria-hidden="true" />
        const label = (() => {
          if (key === 'back') return t('pay.keypad.delete')
          if (key === ',') return t('pay.keypad.decimal')
          return key
        })()
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={label}
            onClick={() => onKey(key)}
            className="flex min-h-16 items-center justify-center rounded-2xl bg-card text-2xl font-semibold text-card-foreground tabular-nums shadow-sm transition-transform select-none active:scale-95 active:bg-muted disabled:opacity-50"
          >
            {key === 'back' ? <Delete aria-hidden="true" className="size-7" /> : key}
          </button>
        )
      })}
    </div>
  )
}
