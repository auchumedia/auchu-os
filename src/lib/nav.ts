import {
  LayoutDashboard, Users, Receipt, Brain, Settings, UserCircle, UsersRound,
} from 'lucide-react'
import type { OrgRole } from '@/types'

export type NavItem = { href: string; icon: React.ElementType; label: string }

// Ordre exact requis partout (sidebar desktop + bottom nav mobile) :
// Tableau de bord, Mon espace, Clients, Finance, Équipe (owner/manager),
// Agents IA, Paramètres.
export function buildNav(role: OrgRole): NavItem[] {
  const isOwnerOrManager = role === 'owner' || role === 'manager'
  const isEditor         = role === 'editor'
  const isPartner        = role === 'partner'

  const items: NavItem[] = [
    { href: '/dashboard',            icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/dashboard/mon-espace', icon: UserCircle,      label: 'Mon espace'      },
  ]

  if (isOwnerOrManager || isEditor) {
    items.push({ href: '/dashboard/clients', icon: Users, label: 'Clients' })
  } else if (isPartner) {
    items.push({ href: '/dashboard/clients', icon: Users, label: 'Mes clients' })
  }
  // viewer : pas d'accès direct à la liste clients (voir "Mon espace" pour ses clients assignés)

  if (isOwnerOrManager) {
    items.push({ href: '/dashboard/finance', icon: Receipt,    label: 'Finance' })
    items.push({ href: '/dashboard/equipe',  icon: UsersRound, label: 'Équipe'  })
  }

  if (isOwnerOrManager || isPartner) {
    items.push({ href: '/agents/productivite', icon: Brain, label: 'Agent productivité' })
  }

  if (role !== 'partner') {
    items.push({ href: '/settings', icon: Settings, label: 'Paramètres' })
  }

  return items
}
