import { ShopNameSchema, WalletAddressInputSchema, type WalletLookupResponse } from '@anypay/shared'
import { CircleCheck, LoaderCircle } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Field } from '@/components/Field'
import { WalletAddressField } from '@/components/WalletAddressField'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { useErrorText } from '@/hooks/useErrorText'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { api } from '@/lib/api'
import { errorMessageKey } from '@/lib/error-message'
import { setMerchantSession } from '@/lib/merchant-session'
import { uuid } from '@/lib/uuid'

type Busy = 'idle' | 'checking' | 'creating'

/**
 * Feature 1, under two minutes: wallet address → check it → shop name → poster. The wallet is
 * checked first, so the shop name step can show which currency payments will arrive in.
 */
export function Component() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const [walletInput, setWalletInput] = useState('')
  const [wallet, setWallet] = useState<WalletLookupResponse | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<Busy>('idle')
  const [error, setError] = useState<string | undefined>()
  const createKey = useRef<string | null>(null)

  async function checkWallet(event: FormEvent) {
    event.preventDefault()
    const parsed = WalletAddressInputSchema.safeParse(walletInput)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message)
    setBusy('checking')
    setError(undefined)
    try {
      const found = await api.lookupWallet(parsed.data)
      setWallet(found)
      setName((current) => current || found.publicName || '')
    } catch (caught) {
      setError(errorMessageKey(caught))
    } finally {
      setBusy('idle')
    }
  }

  async function createShop(event: FormEvent) {
    event.preventDefault()
    if (!wallet) return
    const parsed = ShopNameSchema.safeParse(name)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message)
    // One key per attempt: a retry after a dropped connection can't create a second shop.
    createKey.current ??= uuid()
    setBusy('creating')
    setError(undefined)
    try {
      const { shop, merchantToken } = await api.createShop(
        { name: parsed.data, walletAddress: wallet.walletAddress },
        createKey.current,
      )
      setMerchantSession({
        shopId: shop.id,
        name: shop.name,
        token: merchantToken,
        assetCode: shop.assetCode,
        assetScale: shop.assetScale,
      })
      navigate('/merchant/poster', { replace: true })
    } catch (caught) {
      setError(errorMessageKey(caught))
      setBusy('idle')
    }
  }

  const step = wallet ? 2 : 1
  const errorMessage = error ? errorText(error) : undefined

  return (
    <Page title={t('setup.title')}>
      <p className="mt-1 text-muted-foreground">{t('setup.step', { current: step, total: 2 })}</p>
      {!online && <p className="mt-6 rounded-card bg-muted px-5 py-4">{t('common.offline')}</p>}

      {wallet ? (
        <form onSubmit={createShop} className="mt-8 flex flex-col gap-6" noValidate>
          <div className="flex items-start gap-3 rounded-card bg-card px-5 py-4 text-card-foreground">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t('setup.walletFound')}</p>
              <p className="truncate text-sm text-muted-foreground">{wallet.walletAddress}</p>
              <p className="text-sm">{t('setup.receivesIn', { currency: wallet.assetCode })}</p>
            </div>
            <Button type="button" variant="ghost" onClick={() => setWallet(null)}>
              {t('setup.change')}
            </Button>
          </div>
          <Field
            label={t('setup.nameLabel')}
            hint={t('setup.nameHint')}
            error={errorMessage}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="organization"
            maxLength={60}
            required
          />
          <Button type="submit" size="lg" disabled={busy !== 'idle' || !online}>
            {busy === 'creating' && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            {busy === 'creating' ? t('setup.creating') : t('setup.create')}
          </Button>
        </form>
      ) : (
        <form onSubmit={checkWallet} className="mt-8 flex flex-col gap-6" noValidate>
          <WalletAddressField
            label={t('setup.walletLabel')}
            error={errorMessage}
            value={walletInput}
            onChange={setWalletInput}
          />
          <Button type="submit" size="lg" disabled={busy !== 'idle' || !online}>
            {busy === 'checking' && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            {busy === 'checking' ? t('setup.checking') : t('setup.check')}
          </Button>
        </form>
      )}
    </Page>
  )
}
