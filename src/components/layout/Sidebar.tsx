'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, FolderKanban, FileText,
  Receipt, BarChart2, Sparkles, Brain, Settings, LogOut, Zap,
} from 'lucide-react'

const navSections = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
      { href: '/dashboard/clients', icon: Users, label: 'Clients' },
      { href: '/dashboard/projets', icon: FolderKanban, label: 'Projets' },
      { href: '/dashboard/contenu', icon: FileText, label: 'Contenu' },
      { href: '/dashboard/finance', icon: Receipt, label: 'Finance' },
    ],
  },
  {
    label: 'Agents IA',
    items: [
      { href: '/agents/contenu', icon: Sparkles, label: 'Agent contenu' },
      { href: '/agents/productivite', icon: Brain, label: 'Agent productivité' },
    ],
  },
]

export default function Sidebar({ agencyName, userName }: { agencyName?: string; userName?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside
      className="fixed left-0 top-0 h-full bg-white border-r border-gray-100 flex flex-col"
      style={{ width: 'var(--sidebar-width, 240px)' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-auchu-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{agencyName || 'AuchuOS'}</p>
            <p className="text-xs text-gray-400 truncate">{userName || ''}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn('sidebar-link', isActive && 'active')}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-0.5">
        <Link
          href="/settings"
          className={cn('sidebar-link', pathname.startsWith('/settings') && 'active')}
        >
          <Settings className="w-4 h-4" />
          <span>Paramètres</span>
        </Link>
        <button onClick={handleLogout} className="sidebar-link w-full text-left text-red-500 hover:bg-red-50 hover:text-red-600">
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
