import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

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
  children: ReactNode
}

/**
 * Standard page frame: Apple-style large title, safe-area aware, one readable column.
 * The h1 takes focus after navigation (see useRouteFocus), so it needs tabIndex -1.
 */
export function Page({ title, children }: Readonly<PageProps>) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-[max(2rem,env(safe-area-inset-top))]">
      <DocumentTitle title={title} />
      <h1 tabIndex={-1} className="text-title font-bold tracking-title focus:outline-none">
        {title}
      </h1>
      {children}
    </div>
  )
}
