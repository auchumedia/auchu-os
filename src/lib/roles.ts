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

// role vient de la DB (colonne text, pas un enum Postgres) — sa valeur
// runtime peut ne pas correspondre au type OrgRole si une migration n'a pas
// (encore) tourné. On indexe donc toujours via manageableRoles()/roleLabel()
// plutôt que MANAGEABLE_ROLES[x]/ROLE_LABELS[x] directement, pour ne jamais
// planter tout le dashboard sur un rôle legacy/inconnu.
export function manageableRoles(actor: string): OrgRole[] {
  return MANAGEABLE_ROLES[actor as OrgRole] ?? []
}

export function canManageRole(actor: string, target: string): boolean {
  return manageableRoles(actor).includes(target as OrgRole)
}

export const ROLE_LABELS: Record<OrgRole, { label: string; cls: string; desc: string }> = {
  owner:       { label: 'Propriétaire', cls: 'bg-auchu-100  text-auchu-700',  desc: 'Accès complet, facturation, suppression de comptes' },
  director:    { label: 'Directeur',    cls: 'bg-purple-100 text-purple-700', desc: 'Vue globale de l\'agence, gère les rôles en dessous' },
  chef_equipe: { label: 'Chef d\'équipe', cls: 'bg-blue-100   text-blue-700',   desc: 'Gère son équipe et ses clients assignés' },
  stratege:    { label: 'Stratège',     cls: 'bg-orange-100 text-orange-700', desc: 'Clients assignés et membres de son équipe' },
  monteur:     { label: 'Monteur',      cls: 'bg-green-100  text-green-700',  desc: 'Projets vidéo assignés et membres de son équipe' },
}

const UNKNOWN_ROLE_LABEL = { label: 'Rôle inconnu', cls: 'bg-gray-100 text-gray-600', desc: '' }

export function roleLabel(role: string) {
  return ROLE_LABELS[role as OrgRole] ?? UNKNOWN_ROLE_LABEL
}

// Ordre hiérarchique du plus élevé au plus bas — utilisé pour trier les
// listes de membres (owner en premier, puis director, etc.). Un rôle
// legacy/inconnu (migration pas encore appliquée) est relégué en dernier
// plutôt que de planter le tri.
const ROLE_ORDER: OrgRole[] = ['owner', 'director', 'chef_equipe', 'stratege', 'monteur']

export function roleSortIndex(role: string): number {
  const i = ROLE_ORDER.indexOf(role as OrgRole)
  return i === -1 ? ROLE_ORDER.length : i
}
