import { BookOpen, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/EmptyState'
import { Page } from '@/components/Page'
import { useOffline, useOfflineQuery } from '@/hooks/useOffline'
import { usesOfflineTabs } from '@/lib/offline-flag'

/** The customer's tabs on this phone (Feature 4). */
export function Component() {
  const { t } = useTranslation()
  return (
    <Page title={t('tab.title')}>
      {/* Only phones that have opened a tab download the offline store. */}
      {usesOfflineTabs() ? <TabList /> : <NoTabs />}
    </Page>
  )
}

function NoTabs() {
  const { t } = useTranslation()
  return (
    <div className="mt-8">
      <EmptyState
        icon={BookOpen}
        title={t('tab.empty.title')}
        description={`${t('tab.empty.description')} ${t('tab.howToOpen')}`}
      />
    </div>
  )
}

function TabList() {
  const { t } = useTranslation()
  const offline = useOffline()
  const tabs = useOfflineQuery(offline, 'my-tabs', async (store) => {
    const rows = await store.listMyTabs()
    return Promise.all(rows.map(async (tab) => ({ tab, remaining: await store.remainingOn(tab) })))
  })
  if (tabs === undefined) return null
  if (tabs.length === 0) return <NoTabs />
  return (
    <ul className="mt-8 flex flex-col gap-3">
      {tabs.map(({ tab, remaining }) => (
        <li key={tab.id}>
          <Link
            to={`/tab/${tab.id}`}
            className="flex min-h-16 items-center justify-between gap-4 rounded-card bg-card px-5 py-4 text-card-foreground"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-lg font-semibold">{tab.shopName}</span>
              <span className="text-sm text-muted-foreground">{t(`tab.status.${tab.status}`)}</span>
            </span>
            <span className="flex items-center gap-2">
              {tab.status === 'active' && remaining && (
                <Amount money={remaining} className="text-xl" />
              )}
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
