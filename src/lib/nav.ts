import {
  LayoutDashboard, Users, Settings, UsersRound, ListTodo, Clock,
} from 'lucide-react'
import type { OrgRole } from '@/types'

export type NavItem = { href: string; icon: React.ElementType; label: string }
export type NavSection = { key: 'principal' | 'equipe' | 'compte'; label: string; items: NavItem[] }

// Structure exacte requise partout (sidebar desktop + bottom nav mobile) :
//   Principal : Tableau de bord, Tâches, Clients
//   ("Mon espace" a été fusionné dans le Tableau de bord — plus d'entrée dédiée.)
//   Équipe    : Équipe (les 5 rôles — owner/director en gestion complète,
//               chef_equipe sur sa propre équipe, stratege/monteur en lecture seule),
//               Rapports temps (owner/director uniquement)
//   Compte    : Paramètres
export function buildNavSections(role: OrgRole): NavSection[] {
  const isOwner    = role === 'owner'
  const isDirector = role === 'director'

  const principal: NavItem[] = [
    { href: '/dashboard',         icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/dashboard/taches',  icon: ListTodo,         label: 'Tâches'          },
    { href: '/dashboard/clients', icon: Users,            label: 'Clients'         },
  ]

  const equipe: NavItem[] = [
    { href: '/dashboard/equipe', icon: UsersRound, label: 'Équipe' },
  ]

  // Rapports temps : owner + director — vue agrégée du temps de toute l'équipe.
  if (isOwner || isDirector) {
    equipe.push({ href: '/dashboard/rapports-temps', icon: Clock, label: 'Rapports temps' })
  }

  const compte: NavItem[] = [
    { href: '/settings', icon: Settings, label: 'Paramètres' },
  ]

  return [
    { key: 'principal', label: 'Principal', items: principal },
    { key: 'equipe',    label: 'Équipe',    items: equipe    },
    { key: 'compte',    label: 'Compte',    items: compte    },
  ]
}
