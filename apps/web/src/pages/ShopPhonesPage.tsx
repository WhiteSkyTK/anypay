import { LoaderCircle, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { Page } from '@/components/Page'
import { QrCode } from '@/components/QrCode'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { useErrorText } from '@/hooks/useErrorText'
import { useMerchantSession } from '@/hooks/useMerchantSession'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { errorMessageKey } from '@/lib/error-message'
import { signInLink, signOutOtherPhones } from '@/lib/merchant-token'

type SignOut =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'working' }
  | { kind: 'done' }
  | { kind: 'failed'; messageKey: string }

/**
 * A shop on more than one phone (a helper's, a new one): add a phone with a sign-in QR code, or,
 * after a phone is lost, sign every other phone out. The code is hidden until asked for, because
 * anyone who scans it can see the shop's sales.
 */
export function Component() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const online = useOnlineStatus()
  const session = useMerchantSession()
  const [showCode, setShowCode] = useState(false)
  const [signOut, setSignOut] = useState<SignOut>({ kind: 'idle' })

  if (!session) return <Navigate to="/merchant/new" replace />

  const working = signOut.kind === 'working'
  const confirm = () => {
    setSignOut({ kind: 'working' })
    signOutOtherPhones(session).then(
      () => {
        setShowCode(false)
        setSignOut({ kind: 'done' })
      },
      (error: unknown) => setSignOut({ kind: 'failed', messageKey: errorMessageKey(error) }),
    )
  }

  return (
    <Page title={t('phones.title')} back="/settings">
      <section aria-labelledby="phones-add" className="mt-8">
        <h2 id="phones-add" className="section-label">
          {t('phones.add.heading')}
        </h2>
        <div className="mt-3 rounded-card bg-card px-5 py-4 text-card-foreground">
          <p>{t('phones.add.description', { shop: session.name })}</p>
          <p className="mt-3 flex gap-2 text-sm font-medium text-warn">
            <ShieldAlert aria-hidden="true" className="size-5 shrink-0" />
            {t('phones.add.warning')}
          </p>
          {showCode && (
            <QrCode
              value={signInLink(session)}
              label={t('phones.add.qrLabel', { shop: session.name })}
              className="mx-auto mt-4 w-full max-w-64"
            />
          )}
          <Button
            size="lg"
            variant="secondary"
            className="mt-4 w-full"
            aria-expanded={showCode}
            onClick={() => setShowCode((shown) => !shown)}
          >
            {showCode ? t('phones.add.hide') : t('phones.add.show')}
          </Button>
        </div>
      </section>

      <section aria-labelledby="phones-sign-out" className="mt-8 pb-12">
        <h2 id="phones-sign-out" className="section-label">
          {t('phones.signOut.heading')}
        </h2>
        <div className="mt-3 rounded-card bg-card px-5 py-4 text-card-foreground">
          <p>{t('phones.signOut.description')}</p>
          <Button
            size="lg"
            variant="outline"
            className="mt-4 w-full"
            disabled={!online || working}
            onClick={() => setSignOut({ kind: 'confirming' })}
          >
            {t('phones.signOut.action')}
          </Button>
          {!online && <p className="mt-2 text-sm text-muted-foreground">{t('common.offline')}</p>}
          <p aria-live="polite" className="mt-3 text-sm font-medium empty:hidden">
            {signOut.kind === 'done' && t('phones.signOut.done')}
            {signOut.kind === 'failed' && (
              <span className="text-destructive">{errorText(signOut.messageKey)}</span>
            )}
          </p>
        </div>
      </section>

      <Drawer
        open={signOut.kind === 'confirming' || working}
        onOpenChange={(open) => !open && !working && setSignOut({ kind: 'idle' })}
      >
        <DrawerContent>
          <DrawerTitle>{t('phones.signOut.confirmTitle')}</DrawerTitle>
          <DrawerDescription className="mt-1">
            {t('phones.signOut.confirmDescription')}
          </DrawerDescription>
          <Button
            size="lg"
            variant="destructive"
            className="mt-8 w-full"
            disabled={working}
            onClick={confirm}
          >
            {working && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            {t('phones.signOut.action')}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="mt-3 w-full"
            disabled={working}
            onClick={() => setSignOut({ kind: 'idle' })}
          >
            {t('common.cancel')}
          </Button>
        </DrawerContent>
      </Drawer>
    </Page>
  )
}
