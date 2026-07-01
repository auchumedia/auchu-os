'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LogOut, Zap } from 'lucide-react'
import { buildNavSections } from '@/lib/nav'
import type { OrgRole } from '@/types'

export default function Sidebar({
  agencyName, userName, role = 'owner',
}: {
  agencyName?: string
  userName?: string
  role?: OrgRole
}) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const navSections = buildNavSections(role).filter(s => s.items.length > 0)

  const ROLE_BADGES: Record<OrgRole, { label: string; cls: string }> = {
    owner:   { label: 'Propriétaire', cls: 'bg-auchu-100  text-auchu-700'  },
    manager: { label: 'Manager',      cls: 'bg-blue-100   text-blue-700'   },
    partner: { label: 'Partenaire',   cls: 'bg-orange-100 text-orange-700' },
    editor:  { label: 'Éditeur',      cls: 'bg-green-100  text-green-700'  },
    viewer:  { label: 'Observateur',  cls: 'bg-gray-100   text-gray-600'   },
  }
  const badge = ROLE_BADGES[role]

  return (
    <aside
      className="fixed left-0 top-0 h-full bg-white border-r border-gray-100 flex-col z-10 hidden md:flex"
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
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs text-gray-400 truncate">{userName || ''}</p>
              {role !== 'owner' && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0', badge.cls)}>
                  {badge.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section, i) => (
          <div key={section.key} className={cn(i > 0 && 'mt-4 pt-4 border-t border-gray-100')}>
            {section.key !== 'principal' && (
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 mb-1.5">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href)
                return (
                  <Link key={item.href} href={item.href} className={cn('sidebar-link', isActive && 'active')}>
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
        <button onClick={handleLogout} className="sidebar-link w-full text-left text-red-500 hover:bg-red-50 hover:text-red-600">
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
