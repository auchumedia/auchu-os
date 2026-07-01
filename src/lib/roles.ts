import type { OrgRole } from '@/types'
export type { OrgRole }

// Rôles que chaque acteur peut attribuer/modifier — miroir exact de
// can_manage_role() dans supabase/migrations/021_teams_schema.sql.
// Les deux copies doivent rester synchronisées manuellement.
export const MANAGEABLE_ROLES: Record<OrgRole, OrgRole[]> = {
  owner:       ['director', 'chef_equipe', 'stratege', 'monteur'],
  director:    ['chef_equipe', 'stratege', 'monteur'],
  chef_equipe: ['stratege', 'monteur'],
  stratege:    [],
  monteur:     [],
}

export function canManageRole(actor: OrgRole, target: OrgRole): boolean {
  return MANAGEABLE_ROLES[actor].includes(target)
}

export const ROLE_LABELS: Record<OrgRole, { label: string; cls: string; desc: string }> = {
  owner:       { label: 'Propriétaire', cls: 'bg-auchu-100  text-auchu-700',  desc: 'Accès complet, facturation, suppression de comptes' },
  director:    { label: 'Directeur',    cls: 'bg-purple-100 text-purple-700', desc: 'Vue globale de l\'agence, gère les rôles en dessous' },
  chef_equipe: { label: 'Chef d\'équipe', cls: 'bg-blue-100   text-blue-700',   desc: 'Gère son équipe et ses clients assignés' },
  stratege:    { label: 'Stratège',     cls: 'bg-orange-100 text-orange-700', desc: 'Clients assignés et membres de son équipe' },
  monteur:     { label: 'Monteur',      cls: 'bg-green-100  text-green-700',  desc: 'Projets vidéo assignés et membres de son équipe' },
}
