import {
  exportPublicKey,
  formatMoney,
  generateDeviceKeys,
  OpenTabRequestSchema,
  PublicKeyJwkSchema,
  type WalletLookupResponse,
} from '@anypay/shared'
import { LoaderCircle, Wallet } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Field } from '@/components/Field'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { WalletAddressField } from '@/components/WalletAddressField'
import { useErrorText } from '@/hooks/useErrorText'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useShop } from '@/hooks/useShop'
import { api } from '@/lib/api'
import { errorMessageKey } from '@/lib/error-message'
import { loadOffline } from '@/lib/offline-flag'
import { OfflineStoreError, offlineProblem } from '@/lib/offline-support'
import { cn } from '@/lib/utils'
import { uuid } from '@/lib/uuid'

const WALLET_KEY = 'anypay.customerWallet'
/** Quick choices for the weekly limit, in whole units of the customer's currency. */
const PRESETS = ['50', '100', '200', '500']

function readWallet(): string {
  try {
    return localStorage.getItem(WALLET_KEY) ?? ''
  } catch {
    return ''
  }
}

type Step = 'details' | 'checking' | 'cap' | 'approving'

/**
 * Opening a tab (online, once): the customer approves a weekly limit in their own wallet, and
 * this phone makes the key that will sign their offline payments. The private key never leaves
 * the phone; only its public half goes to AnyPay with the tab.
 */
export function Component() {
  // Before anything is asked of the customer: a tab needs a device key and storage this browser
  // may not offer (the error screen says which).
  const problem = offlineProblem()
  if (problem) throw new OfflineStoreError(problem)
  return <OpenTab />
}

function OpenTab() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const online = useOnlineStatus()
  const { shopId = '' } = useParams()
  const { state: shop } = useShop(shopId)
  const [wallet, setWallet] = useState(readWallet)
  const [label, setLabel] = useState('')
  const [customer, setCustomer] = useState<WalletLookupResponse | null>(null)
  const [cap, setCap] = useState('200')
  const [step, setStep] = useState<Step>('details')
  const [error, setError] = useState<string>()
  const attemptKey = useRef<string | null>(null)
  const shopName = shop.kind === 'ready' ? shop.shop.name : ''

  async function checkDetails(event: FormEvent) {
    event.preventDefault()
    const labelCheck = OpenTabRequestSchema.shape.label.safeParse(label)
    if (!labelCheck.success) return setError(labelCheck.error.issues[0]?.message)
    setStep('checking')
    setError(undefined)
    try {
      setCustomer(await api.lookupWallet(wallet.trim()))
      setStep('cap')
    } catch (caught) {
      setError(errorMessageKey(caught))
      setStep('details')
    }
  }

  async function approve() {
    setStep('approving')
    setError(undefined)
    try {
      const keys = await generateDeviceKeys()
      attemptKey.current ??= uuid()
      const { tab, consentUrl } = await api.openTab(
        shopId,
        {
          customerWallet: wallet.trim(),
          weeklyCap: cap,
          label: label.trim(),
          publicKey: PublicKeyJwkSchema.parse(await exportPublicKey(keys.publicKey)),
        },
        attemptKey.current,
      )
      const offline = await loadOffline()
      await offline.saveTabKeys(tab.id, keys)
      await offline.rememberTab(tab)
      try {
        localStorage.setItem(WALLET_KEY, wallet.trim())
      } catch {
        // Not remembered: typed again next time.
      }
      if (consentUrl && new URL(consentUrl).protocol === 'https:')
        window.location.assign(consentUrl)
      else setError('errors.api.unknown')
    } catch (caught) {
      setError(errorMessageKey(caught))
      setStep('cap')
    }
  }

  const errorMessage = error ? errorText(error) : undefined
  const busy = step === 'checking' || step === 'approving'

  return (
    <Page title={t('tab.open.title')} back={`/shop/${shopId}/pay`}>
      <p className="mt-2 text-muted-foreground">{t('tab.open.intro', { shop: shopName })}</p>
      {!online && <p className="mt-6 rounded-card bg-muted px-5 py-4">{t('tab.open.offline')}</p>}

      {step === 'details' || step === 'checking' ? (
        <form onSubmit={checkDetails} className="mt-8 flex flex-col gap-6" noValidate>
          <WalletAddressField
            label={t('pay.walletLabel')}
            value={wallet}
            onChange={setWallet}
            disabled={busy}
          />
          <Field
            label={t('tab.open.labelLabel')}
            hint={t('tab.open.labelHint')}
            error={errorMessage}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={30}
            autoComplete="given-name"
          />
          <Button type="submit" size="lg" disabled={busy || !online || !wallet.trim()}>
            {busy && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            {busy ? t('tab.open.checking') : t('tab.open.continue')}
          </Button>
        </form>
      ) : (
        <CapStep
          currency={customer?.assetCode ?? ''}
          assetScale={customer?.assetScale ?? 2}
          cap={cap}
          onCap={setCap}
          error={errorMessage}
          busy={busy}
          online={online}
          onApprove={() => void approve()}
        />
      )}
    </Page>
  )
}

interface CapStepProps {
  currency: string
  assetScale: number
  cap: string
  onCap: (cap: string) => void
  error?: string
  busy: boolean
  online: boolean
  onApprove: () => void
}

function CapStep({
  currency,
  assetScale,
  cap,
  onCap,
  error,
  busy,
  online,
  onApprove,
}: Readonly<CapStepProps>) {
  const { t } = useTranslation()
  const money = (value: string) =>
    formatMoney({ value: `${value}${'0'.repeat(assetScale)}`, assetCode: currency, assetScale })
  const custom = !PRESETS.includes(cap)
  return (
    <div className="mt-8 flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="font-semibold">{t('tab.open.capLabel')}</legend>
        <div className="grid grid-cols-2 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={cap === preset}
              onClick={() => onCap(preset)}
              className={cn(
                'min-h-14 rounded-2xl border-2 text-lg font-semibold tabular-nums',
                cap === preset
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-card-foreground',
              )}
            >
              {money(preset)}
            </button>
          ))}
        </div>
        <Field
          label={t('tab.open.customLabel')}
          value={custom ? cap : ''}
          onChange={(event) => onCap(event.target.value.replace(/[^\d]/g, '').slice(0, 7))}
          inputMode="numeric"
          placeholder={currency}
        />
        <p className="text-sm text-muted-foreground">{t('tab.open.capHint')}</p>
      </fieldset>
      {error && (
        <p role="alert" className="rounded-card bg-card px-5 py-4 font-medium text-destructive">
          {error}
        </p>
      )}
      <Button size="lg" onClick={onApprove} disabled={busy || !online || !/^[1-9]\d*$/.test(cap)}>
        {busy ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Wallet aria-hidden="true" />
        )}
        {busy ? t('tab.open.redirecting') : t('tab.open.approve')}
      </Button>
    </div>
  )
}
