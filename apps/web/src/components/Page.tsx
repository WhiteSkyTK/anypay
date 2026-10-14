import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BackButton } from './BackButton'

interface DocumentTitleProps {
  title: string
}

/** Sets the browser tab title (React 19 hoists <title> into <head>). */
export function DocumentTitle({ title }: Readonly<DocumentTitleProps>) {
  const { t } = useTranslation()
  return <title>{`${title} · ${t('app.name')}`}</title>
}

interface PageProps {
  title: string
  /** Shows "‹ Back" above the title; the route to use when there is no in-app history. */
  back?: string
  children: ReactNode
}

/**
 * Standard page frame: Apple-style large title, safe-area aware, one readable column.
 * The h1 takes focus after navigation (see useRouteFocus), so it needs tabIndex -1.
 */
export function Page({ title, back, children }: Readonly<PageProps>) {
  return (
    <div
      className={
        back
          ? 'mx-auto w-full max-w-xl px-4 pt-[max(0.5rem,env(safe-area-inset-top))]'
          : 'mx-auto w-full max-w-xl px-4 pt-[max(2rem,env(safe-area-inset-top))]'
      }
    >
      <DocumentTitle title={title} />
      {back && <BackButton fallback={back} className="mb-2" />}
      <h1 tabIndex={-1} className="text-title font-bold tracking-title focus:outline-none">
        {title}
      </h1>
      {children}
    </div>
  )
}
