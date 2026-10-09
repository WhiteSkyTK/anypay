import { type ComponentProps, useId } from 'react'
import { cn } from '@/lib/utils'

interface FieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string
  hint?: string
  /** Translated error text; also marks the input invalid for screen readers. */
  error?: string
}

/** A labelled input with its hint and error wired up for screen readers. */
export function Field({ label, hint, error, className, ...input }: Readonly<FieldProps>) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="min-h-12 w-full rounded-2xl border-2 border-input bg-card px-4 text-base text-card-foreground placeholder:text-muted-foreground aria-invalid:border-destructive"
        {...input}
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
