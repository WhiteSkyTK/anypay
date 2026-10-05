import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouteError } from 'react-router'
import { DocumentTitle } from '@/components/Page'
import { Button } from '@/components/ui/button'

/** Last-resort screen if a route crashes or its code can't load. */
export function RouteError() {
  const error = useRouteError()
  const { t } = useTranslation()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <DocumentTitle title={t('error.title')} />
        <h1 className="text-title font-bold tracking-title">{t('error.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('error.description')}</p>
        <Button className="mt-8" onClick={() => window.location.reload()}>
          {t('error.reload')}
        </Button>
      </div>
    </main>
  )
}
