import { ChevronDown, Languages } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { setLanguage } from '@/i18n'
import { isLanguageCode, LANGUAGES } from '@/i18n/languages'
import { cn } from '@/lib/utils'

interface LanguageSelectProps {
  className?: string
  /** Hide the visible label where the globe icon and layout already make it obvious. */
  hideLabel?: boolean
}

/**
 * A native <select>: familiar on every phone, opens the OS picker with big targets, and works
 * with screen readers and keyboards for free. Each language is listed in its own words.
 */
export function LanguageSelect({ className, hideLabel = false }: Readonly<LanguageSelectProps>) {
  const { t, i18n } = useTranslation()
  const id = useId()

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'section-label'}>
        {t('language.label')}
      </label>
      <div className="relative flex items-center">
        <Languages aria-hidden="true" className="pointer-events-none absolute left-4 size-4" />
        <select
          id={id}
          value={i18n.resolvedLanguage}
          onChange={(event) => {
            const code = event.target.value
            if (isLanguageCode(code)) void setLanguage(code)
          }}
          className="min-h-12 w-full appearance-none rounded-full border-2 border-input bg-transparent pr-11 pl-11 font-semibold text-foreground"
        >
          {LANGUAGES.map(({ code, name }) => (
            <option key={code} value={code} lang={code}>
              {name}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 size-4" />
      </div>
    </div>
  )
}
