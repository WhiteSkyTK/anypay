import type { Shop } from '@anypay/shared'
import { LoaderCircle, Store } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Keypad } from '@/components/Keypad'
import { DocumentTitle, Page } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { WalletAddressField } from '@/components/WalletAddressField'
import { useErrorText } from '@/hooks/useErrorText'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { usePaymentFlow } from '@/hooks/usePaymentFlow'
import { useShop } from '@/hooks/useShop'
import { applyKey, isPayable, normaliseTyped } from '@/lib/keypad'

// The sheet (vaul + Radix Dialog) is most of this screen's code. It loads while the quote is being
// fetched instead of with the page, so a customer's first scan downloads less.
const loadQuoteSheet = () => import('@/components/QuoteSheet')
const QuoteSheet = lazy(() => loadQuoteSheet().then((module) => ({ default: module.QuoteSheet })))

function currencySymbol(assetCode: string): string {
  try {
    const parts = new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: assetCode,
    }).formatToParts(0)
    return parts.find((part) => part.type === 'currency')?.value ?? assetCode
  } catch {
    return assetCode
  }
}

/** Feature 2 for one shop: type the amount, see the exact price, approve in your own wallet. */
function PayForm({ shop }: Readonly<{ shop: Shop }>) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const online = useOnlineStatus()
  const flow = usePaymentFlow(shop)
  const [typed, setTyped] = useState('')
  const continueRef = useRef<HTMLButtonElement>(null)
  const { state } = flow

  const busy = state.kind === 'quoting' || state.kind === 'redirecting'
  const canContinue = isPayable(typed) && flow.wallet.trim() !== '' && !busy && online
  const quoted =
    state.kind === 'quoted' || state.kind === 'redirecting' ? state.response : undefined

  const closeQuote = () => {
    // The sheet unmounts with nothing to hand focus back to, so return it to where the customer
    // was. flushSync re-enables Continue first: a disabled button can't take focus.
    flushSync(flow.edit)
    continueRef.current?.focus()
  }

  return (
    <Page title={shop.name}>
      <p className="mt-1 text-muted-foreground">{t('pay.subtitle')}</p>

      <section className="my-8 text-center">
        <label htmlFor="amount" className="section-label">
          {t('pay.amountLabel')}
        </label>
        <div className="mt-2 flex items-baseline justify-center gap-2 text-amount font-bold tracking-title tabular-nums">
          <span aria-hidden="true">{currencySymbol(shop.assetCode)}</span>
          {/* Typing works too (keyboards, screen readers); the keypad is the fast path. */}
          <input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={typed}
            onChange={(event) => setTyped(normaliseTyped(event.target.value, shop.assetScale))}
            disabled={busy}
            style={{ width: `${Math.max(typed.length, 1) + 0.5}ch` }}
            className="min-w-0 bg-transparent text-center outline-none placeholder:text-muted-foreground"
          />
        </div>
      </section>

      <Keypad
        decimals={shop.assetScale}
        disabled={busy}
        onKey={(key) => setTyped((current) => applyKey(current, key, shop.assetScale))}
      />

      <WalletAddressField
        className="mt-6"
        label={t('pay.walletLabel')}
        hint={t('pay.walletHint')}
        value={flow.wallet}
        onChange={flow.setWallet}
        disabled={busy}
      />

      {!online && <p className="mt-4 rounded-card bg-muted px-5 py-4">{t('common.offline')}</p>}
      {state.kind === 'error' && (
        <p
          role="alert"
          className="mt-4 rounded-card bg-card px-5 py-4 font-medium text-destructive"
        >
          {errorText(state.messageKey)}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 mt-6 bg-background/90 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <Button
          ref={continueRef}
          size="lg"
          className="w-full"
          disabled={!canContinue}
          onClick={() => {
            void loadQuoteSheet()
            void flow.requestQuote(typed.replace(',', '.'))
          }}
        >
          {state.kind === 'quoting' && <LoaderCircle aria-hidden="true" className="animate-spin" />}
          {state.kind === 'quoting' ? t('pay.gettingQuote') : t('pay.continue')}
        </Button>
      </div>

      {quoted?.quote && (
        <Suspense fallback={null}>
          <QuoteSheet
            open
            shopName={shop.name}
            quote={quoted.quote}
            redirecting={state.kind === 'redirecting'}
            onApprove={flow.approve}
            onCancel={closeQuote}
          />
        </Suspense>
      )}
    </Page>
  )
}

export function Component() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { shopId = '' } = useParams()
  const { state, retry } = useShop(shopId)

  if (state.kind === 'ready') return <PayForm shop={state.shop} />

  if (state.kind === 'loading') {
    return (
      <div
        aria-busy="true"
        className="mx-auto w-full max-w-xl px-4 pt-[max(2rem,env(safe-area-inset-top))]"
      >
        <DocumentTitle title={t('pay.amountLabel')} />
        <div className="h-10 w-2/3 animate-pulse rounded-card bg-muted" />
        <div className="mx-auto mt-12 h-16 w-1/2 animate-pulse rounded-card bg-muted" />
        <div className="mt-10 grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, key) => (
            <div key={key} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <Page title={state.notFound ? t('pay.notFound.title') : t('error.title')}>
      <div className="mt-8 flex flex-col gap-6">
        <EmptyState
          icon={Store}
          title={state.notFound ? undefined : errorText(state.messageKey)}
          description={state.notFound ? t('pay.notFound.description') : t('error.description')}
        />
        {!state.notFound && (
          <Button size="lg" onClick={retry}>
            {t('common.retry')}
          </Button>
        )}
      </div>
    </Page>
  )
}
