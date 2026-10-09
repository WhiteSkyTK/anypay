import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  /** Leave out when the page heading already says it. */
  title?: string
  description: string
}

/** Calm placeholder for lists with nothing in them yet; says what will appear and why. */
export function EmptyState({ icon: Icon, title, description }: Readonly<EmptyStateProps>) {
  return (
    <div className="flex flex-col items-center rounded-card bg-card px-6 py-10 text-center text-card-foreground">
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      {title && <p className="mb-1 text-lg font-semibold">{title}</p>}
      <p className="max-w-sm text-muted-foreground">{description}</p>
    </div>
  )
}
