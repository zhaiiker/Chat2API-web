import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Server,
  Settings2,
  FileText,
  Settings,
  Key,
  Cpu,
  Info,
  MessageSquare,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNavigationStore } from '@/stores/navigationStore'

interface NavItem {
  titleKey: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { titleKey: 'nav.dashboard', href: '/', icon: LayoutDashboard },
  { titleKey: 'nav.providers', href: '/providers', icon: Server },
  { titleKey: 'nav.proxy', href: '/proxy', icon: Settings2 },
  { titleKey: 'nav.models', href: '/models', icon: Cpu },
  { titleKey: 'nav.session', href: '/session', icon: MessageSquare },
  { titleKey: 'nav.apiKeys', href: '/api-keys', icon: Key },
  { titleKey: 'nav.logs', href: '/logs', icon: FileText },
  { titleKey: 'nav.settings', href: '/settings', icon: Settings },
  { titleKey: 'nav.about', href: '/about', icon: Info },
]

export function MobileSidebar() {
  const { t } = useTranslation()
  const { mobileSidebarOpen, setMobileSidebarOpen } = useSettingsStore()
  const { blockers } = useNavigationStore()
  const navigate = useNavigate()
  const location = useLocation()

  const hasBlockers = blockers.length > 0

  const handleNavigation = (href: string) => {
    if (hasBlockers && location.pathname !== href) {
      // Let the navigation blocker dialog handle this
      return
    }
    navigate(href)
    setMobileSidebarOpen(false)
  }

  if (!mobileSidebarOpen) return null

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        onClick={() => setMobileSidebarOpen(false)}
      />
      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 flex flex-col md:hidden',
          'glass-sidebar !m-0 !rounded-none !rounded-r-2xl',
          'animate-in slide-in-from-left duration-300'
        )}
      >
        {/* Close button */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
          <span className="text-base font-semibold text-[var(--text-primary)]">
            {t('nav.menu', 'Menu')}
          </span>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)] transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const title = t(item.titleKey)
            return (
              <div
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className="block cursor-pointer"
              >
                <NavLink
                  to={item.href}
                  onClick={(e) => {
                    e.preventDefault()
                  }}
                  className={({ isActive }) =>
                    cn(
                      'sidebar-nav-item expanded',
                      isActive ? 'active' : 'inactive'
                    )
                  }
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="whitespace-nowrap">{title}</span>
                </NavLink>
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
