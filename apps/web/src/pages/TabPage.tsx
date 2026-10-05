import { BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/EmptyState'
import { Page } from '@/components/Page'

/** Customer's Offline Digital Tabs (Phase 3). */
export function Component() {
  const { t } = useTranslation()
  return (
    <Page title={t('tab.title')}>
      <div className="mt-8">
        <EmptyState
          icon={BookOpen}
          title={t('tab.empty.title')}
          description={t('tab.empty.description')}
        />
      </div>
    </Page>
  )
}
