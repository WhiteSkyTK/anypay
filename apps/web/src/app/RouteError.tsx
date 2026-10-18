import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouteError } from 'react-router'
import { DocumentTitle } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { OfflineStoreError, offlineProblemKey } from '@/lib/offline-support'
import { useHideSplash } from './useHideSplash'

/**
 * Last-resort screen if a route crashes or its code can't load. A phone that can't keep offline
 * tabs (plain http, blocked or full storage) is told why: reloading wouldn't change that.
 */
export function RouteError() {
  const error = useRouteError()
  const { t } = useTranslation()
  useHideSplash()

  useEffect(() => {
    console.error(error)
  }, [error])

  const offline = error instanceof OfflineStoreError ? error.problem : null
  const title = offline ? t('offline.unavailableTitle') : t('error.title')

  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <DocumentTitle title={title} />
        <h1 className="text-title font-bold tracking-title">{title}</h1>
        <p className="mt-2 text-muted-foreground">
          {offline ? t(offlineProblemKey(offline)) : t('error.description')}
        </p>
        {offline ? (
          // A full page load: the error replaced the app's own navigation.
          <Button asChild className="mt-8">
            <a href="/">{t('notFound.home')}</a>
          </Button>
        ) : (
          <Button className="mt-8" onClick={() => window.location.reload()}>
            {t('error.reload')}
          </Button>
        )}
      </div>
    </main>
  )
}
