import { useId } from 'react'

interface SwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/** A native checkbox with role="switch": keyboard, screen readers and forms work for free. */
export function Switch({ label, checked, onChange, disabled = false }: Readonly<SwitchProps>) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-card bg-card px-5 py-3 text-card-foreground has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
    >
      <span className="font-medium">{label}</span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-8 w-14 shrink-0 rounded-full bg-input transition-colors peer-checked:bg-primary after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-card after:shadow after:transition-transform peer-checked:after:translate-x-6"
      />
    </label>
  )
}
