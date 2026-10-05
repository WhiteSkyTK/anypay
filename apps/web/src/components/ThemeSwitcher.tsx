import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { THEME_MODES, type ThemeMode } from '@/lib/theme'

const ICONS: Record<ThemeMode, LucideIcon> = { system: Monitor, light: Sun, dark: Moon }

/**
 * Segmented control built from native radio buttons: arrow keys, labels and the checked state
 * come for free, and the selected segment is raised (shape and shadow, not just colour).
 */
export function ThemeSwitcher() {
  const { t } = useTranslation()
  const { mode, setMode } = useTheme()

  return (
    <fieldset>
      <legend className="section-label">{t('settings.appearance')}</legend>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
        {THEME_MODES.map((option) => {
          const Icon = ICONS[option]
          return (
            <label
              key={option}
              className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-semibold text-muted-foreground transition-colors has-checked:bg-card has-checked:text-card-foreground has-checked:shadow-sm has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
            >
              <input
                type="radio"
                name="theme"
                value={option}
                checked={mode === option}
                onChange={() => setMode(option)}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="size-4" />
              {t(`settings.theme.${option}`)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
