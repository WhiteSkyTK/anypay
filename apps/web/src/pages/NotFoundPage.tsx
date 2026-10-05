import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/button'

export function Component() {
  const { t } = useTranslation()
  return (
    <Page title={t('notFound.title')}>
      <p className="mt-2 text-muted-foreground">{t('notFound.description')}</p>
      <Button asChild className="mt-8">
        <Link to="/">{t('notFound.home')}</Link>
      </Button>
    </Page>
  )
}
