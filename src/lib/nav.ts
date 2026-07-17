import {
  LayoutDashboard, Users, Receipt, Brain, Settings, UsersRound, ListTodo, FileText, Clock,
} from 'lucide-react'
import type { OrgRole } from '@/types'

export type NavItem = { href: string; icon: React.ElementType; label: string }
export type NavSection = { key: 'principal' | 'equipe' | 'agents' | 'compte'; label: string; items: NavItem[] }

// Structure exacte requise partout (sidebar desktop + bottom nav mobile) :
//   Principal : Tableau de bord, Tâches, Clients, Finance (owner), Mes factures (non-owner)
//   ("Mon espace" a été fusionné dans le Tableau de bord — plus d'entrée dédiée.)
//   Équipe    : Équipe (les 5 rôles — owner/director en gestion complète,
//               chef_equipe sur sa propre équipe, stratege/monteur en lecture seule),
//               Rapports temps (owner/director uniquement)
//   Agents IA : Agent productivité (rôles côté production de contenu)
//   Compte    : Paramètres
export function buildNavSections(role: OrgRole): NavSection[] {
  const isOwner    = role === 'owner'
  const isDirector = role === 'director'

  const principal: NavItem[] = [
    { href: '/dashboard',         icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/dashboard/taches',  icon: ListTodo,         label: 'Tâches'          },
    { href: '/dashboard/clients', icon: Users,            label: 'Clients'         },
  ]

  // Finance : owner uniquement — factures clients de l'agence.
  if (isOwner) {
    principal.push({ href: '/dashboard/finance', icon: Receipt, label: 'Finance' })
  }

  // Mes factures : tous les membres non-owner (director inclus, en tant que
  // membre facturable au même titre que chef_equipe/stratege/monteur).
  if (!isOwner) {
    principal.push({ href: '/dashboard/mes-factures', icon: FileText, label: 'Mes factures' })
  }

  const equipe: NavItem[] = [
    { href: '/dashboard/equipe', icon: UsersRound, label: 'Équipe' },
  ]

  // Rapports temps : owner + director — vue agrégée du temps de toute l'équipe.
  if (isOwner || isDirector) {
    equipe.push({ href: '/dashboard/rapports-temps', icon: Clock, label: 'Rapports temps' })
  }

  // Agents IA : rôles côté production de contenu (le monteur travaille sur
  // des fichiers vidéo livrés, pas sur la génération de contenu écrit).
  const agents: NavItem[] = (isOwner || isDirector || role === 'chef_equipe' || role === 'stratege')
    ? [{ href: '/agents/productivite', icon: Brain, label: 'Agent productivité' }]
    : []

  const compte: NavItem[] = [
    { href: '/settings', icon: Settings, label: 'Paramètres' },
  ]

  return [
    { key: 'principal', label: 'Principal', items: principal },
    { key: 'equipe',    label: 'Équipe',    items: equipe    },
    { key: 'agents',    label: 'Agents IA', items: agents    },
    { key: 'compte',    label: 'Compte',    items: compte    },
  ]
}
