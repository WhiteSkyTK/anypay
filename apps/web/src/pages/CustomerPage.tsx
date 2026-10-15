import { ArrowRight, ScanLine } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Field } from '@/components/Field'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/button'

/** Spaces are only there to make a printed code easier to read ("J6XN G3LF"). */
const normaliseShopCode = (input: string) => input.replaceAll(/\s+/g, '')

/**
 * Where a customer starts: the phone's own camera reads the shop's poster (no app needed), and a
 * code typed from the poster works when the camera can't (cracked lens, glare, an old phone).
 */
export function Component() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const shopCode = normaliseShopCode(code)

  function openShop(event: FormEvent) {
    event.preventDefault()
    if (shopCode) void navigate(`/shop/${encodeURIComponent(shopCode)}/pay`)
  }

  return (
    <Page title={t('customer.title')} back="/">
      <div className="mt-8 flex items-start gap-4 rounded-card bg-card px-5 py-5 text-card-foreground">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <ScanLine aria-hidden="true" className="size-6" />
        </span>
        <p className="text-lg">{t('customer.scan')}</p>
      </div>
      {/* Installed apps can't receive the camera app's links: scan inside AnyPay instead. */}
      <Button asChild size="lg" variant="secondary" className="mt-4 w-full">
        <Link to="/scan">
          <ScanLine aria-hidden="true" />
          {t('customer.scanHere')}
        </Link>
      </Button>

      <p className="my-6 text-center text-sm font-semibold text-muted-foreground uppercase">
        {t('customer.or')}
      </p>

      <form onSubmit={openShop} className="flex flex-col gap-6" noValidate>
        <Field
          label={t('customer.codeLabel')}
          hint={t('customer.codeHint')}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          className="[&_input]:text-xl [&_input]:tracking-widest [&_input]:uppercase"
        />
        <Button type="submit" size="lg" disabled={!shopCode}>
          {t('customer.go')}
          <ArrowRight aria-hidden="true" />
        </Button>
      </form>
    </Page>
  )
}
