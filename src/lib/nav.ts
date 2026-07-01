import {
  LayoutDashboard, Users, Receipt, Brain, Settings, UserCircle, UsersRound,
} from 'lucide-react'
import type { OrgRole } from '@/types'

export type NavItem = { href: string; icon: React.ElementType; label: string }
export type NavSection = { key: 'principal' | 'equipe' | 'agents' | 'compte'; label: string; items: NavItem[] }

// Structure exacte requise partout (sidebar desktop + bottom nav mobile) :
//   Principal : Tableau de bord, Mon espace, Clients, Finance
//   Équipe    : Équipe (owner/manager)
//   Agents IA : Agent productivité
//   Compte    : Paramètres
export function buildNavSections(role: OrgRole): NavSection[] {
  const isOwnerOrManager = role === 'owner' || role === 'manager'
  const isEditor         = role === 'editor'
  const isPartner        = role === 'partner'

  const principal: NavItem[] = [
    { href: '/dashboard',            icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/dashboard/mon-espace', icon: UserCircle,      label: 'Mon espace'      },
  ]

  if (isOwnerOrManager || isEditor) {
    principal.push({ href: '/dashboard/clients', icon: Users, label: 'Clients' })
  } else if (isPartner) {
    principal.push({ href: '/dashboard/clients', icon: Users, label: 'Mes clients' })
  }
  // viewer : pas d'accès direct à la liste clients (voir "Mon espace" pour ses clients assignés)

  if (isOwnerOrManager) {
    principal.push({ href: '/dashboard/finance', icon: Receipt, label: 'Finance' })
  }

  const equipe: NavItem[] = isOwnerOrManager
    ? [{ href: '/dashboard/equipe', icon: UsersRound, label: 'Équipe' }]
    : []

  const agents: NavItem[] = (isOwnerOrManager || isPartner)
    ? [{ href: '/agents/productivite', icon: Brain, label: 'Agent productivité' }]
    : []

  const compte: NavItem[] = role !== 'partner'
    ? [{ href: '/settings', icon: Settings, label: 'Paramètres' }]
    : []

  return [
    { key: 'principal', label: 'Principal', items: principal },
    { key: 'equipe',    label: 'Équipe',    items: equipe    },
    { key: 'agents',    label: 'Agents IA', items: agents    },
    { key: 'compte',    label: 'Compte',    items: compte    },
  ]
}

