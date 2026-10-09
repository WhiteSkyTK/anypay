import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { startOfToday } from '@/lib/format'
import { setMerchantSession } from '@/lib/merchant-session'

interface ConnectLink {
  shopId: string
  token: string
}

function readLink(): ConnectLink | null {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const shopId = params.get('shop')
  const token = params.get('token')
  return shopId && token ? { shopId, token } : null
}

/**
 * Signs a phone in to an existing shop from a link (`npm run seed` prints one for demos). The
 * token is in the URL fragment, which browsers never send to a server, and is removed from the
 * address bar as soon as it has been read.
 */
export function Component() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [link] = useState(readLink)
  const [rejected, setRejected] = useState(false)

  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname)
    if (!link) return
    let active = true
    // The payments call proves the token is the shop's before it is saved.
    Promise.all([
      api.getShop(link.shopId),
      api.shopPayments(link.shopId, link.token, startOfToday()),
    ]).then(
      ([shop]) => {
        if (!active) return
        setMerchantSession({
          shopId: shop.id,
          name: shop.name,
          token: link.token,
          assetCode: shop.assetCode,
          assetScale: shop.assetScale,
        })
        navigate('/merchant', { replace: true })
      },
      () => active && setRejected(true),
    )
    return () => {
      active = false
    }
  }, [link, navigate])

  return (
    <Page title={t('connect.title')}>
      {!link || rejected ? (
        <>
          <p role="alert" className="mt-4 text-muted-foreground">
            {t('connect.failed')}
          </p>
          <Button asChild size="lg" className="mt-8 w-full">
            <Link to="/merchant/new">{t('merchant.setUp.cta')}</Link>
          </Button>
        </>
      ) : (
        <LoaderCircle
          aria-hidden="true"
          className="mx-auto mt-12 size-10 animate-spin text-primary"
        />
      )}
    </Page>
  )
}
