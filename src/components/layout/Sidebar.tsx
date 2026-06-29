'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, FileText, CalendarDays,
  Receipt, Brain, Settings, LogOut, Zap,
  UserCircle, UsersRound,
} from 'lucide-react'
import type { OrgRole } from '@/types'

type NavItem = { href: string; icon: React.ElementType; label: string }

function buildNav(role: OrgRole): { label: string; items: NavItem[] }[] {
  const isOwnerOrManager = role === 'owner' || role === 'manager'
  const isEditor         = role === 'editor'
  const isPartner        = role === 'partner'

  const principal: NavItem[] = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  ]

  if (isOwnerOrManager || isEditor) {
    principal.push({ href: '/dashboard/clients',    icon: Users,        label: 'Clients'    })
    principal.push({ href: '/dashboard/contenu',    icon: FileText,     label: 'Contenu'    })
    principal.push({ href: '/dashboard/calendrier', icon: CalendarDays, label: 'Calendrier' })
  } else if (isPartner) {
    principal.push({ href: '/dashboard/clients',    icon: Users,        label: 'Mes clients' })
    principal.push({ href: '/dashboard/contenu',    icon: FileText,     label: 'Contenu'     })
    principal.push({ href: '/dashboard/calendrier', icon: CalendarDays, label: 'Calendrier'  })
  } else {
    // viewer
    principal.push({ href: '/dashboard/calendrier', icon: CalendarDays, label: 'Calendrier' })
  }

  if (isOwnerOrManager) {
    principal.push({ href: '/dashboard/finance', icon: Receipt, label: 'Finance' })
  }

  const team: NavItem[] = []
  if (isOwnerOrManager) {
    team.push({ href: '/dashboard/equipe', icon: UsersRound, label: 'Équipe' })
  }
  if (role !== 'owner') {
    team.push({ href: '/dashboard/mon-espace', icon: UserCircle, label: 'Mon espace' })
  }

  const agents: NavItem[] = (isOwnerOrManager || isPartner) ? [
    { href: '/agents/productivite', icon: Brain, label: 'Agent productivité' },
  ] : []

  const sections = [{ label: 'Principal', items: principal }]
  if (team.length)   sections.push({ label: 'Équipe', items: team })
  if (agents.length) sections.push({ label: 'Agents IA', items: agents })
  return sections
}

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

  const navSections = buildNav(role)

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
        {role !== 'partner' && (
          <Link href="/settings" className={cn('sidebar-link', pathname.startsWith('/settings') && 'active')}>
            <Settings className="w-4 h-4" />
            <span>Paramètres</span>
          </Link>
        )}
        <button onClick={handleLogout} className="sidebar-link w-full text-left text-red-500 hover:bg-red-50 hover:text-red-600">
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
