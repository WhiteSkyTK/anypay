import { BookOpen, Settings, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/merchant', labelKey: 'nav.shop', Icon: Store },
  { to: '/tab', labelKey: 'nav.tab', Icon: BookOpen },
  { to: '/settings', labelKey: 'nav.settings', Icon: Settings },
] as const

/**
 * Floating pill tab bar (wallet-blue reference), but with text labels under the icons:
 * icons alone are guesswork for new or low-literacy users. The active tab is a filled pill,
 * so the state never depends on colour alone; NavLink also sets aria-current="page".
 */
export function TabBar() {
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t('nav.label')}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <ul className="glass-bar pointer-events-auto flex gap-1 rounded-full border p-1.5 shadow-lg shadow-black/10">
        {TABS.map(({ to, labelKey, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 min-w-20 flex-col items-center justify-center gap-0.5 rounded-full px-4 text-[0.8125rem] font-semibold transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                )
              }
            >
              <Icon aria-hidden="true" className="size-5" />
              {t(labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
