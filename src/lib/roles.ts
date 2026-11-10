import type { OrgRole } from '@/types'
export type { OrgRole }

// Rôles que chaque acteur peut attribuer/modifier — miroir exact de
// can_manage_role() dans supabase/migrations/045_remove_chef_equipe_refs.sql.
// Les deux copies doivent rester synchronisées manuellement.
export const MANAGEABLE_ROLES: Record<OrgRole, OrgRole[]> = {
  owner:    ['director', 'stratege', 'monteur'],
  director: ['stratege', 'monteur'],
  stratege: [],
  monteur:  [],
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
  owner:    { label: 'Propriétaire', cls: 'bg-auchu-100  text-auchu-700',  desc: 'Accès complet, facturation, suppression de comptes' },
  director: { label: 'Directeur',    cls: 'bg-purple-100 text-purple-700', desc: 'Vue globale de l\'agence, gère les rôles en dessous' },
  stratege: { label: 'Stratège',     cls: 'bg-orange-100 text-orange-700', desc: 'Contacts assignés et membres de son équipe' },
  monteur:  { label: 'Monteur',      cls: 'bg-green-100  text-green-700',  desc: 'Projets vidéo assignés et membres de son équipe' },
}

const UNKNOWN_ROLE_LABEL = { label: 'Rôle inconnu', cls: 'bg-gray-100 text-gray-600', desc: '' }

export function roleLabel(role: string) {
  return ROLE_LABELS[role as OrgRole] ?? UNKNOWN_ROLE_LABEL
}

// Ordre hiérarchique du plus élevé au plus bas — utilisé pour trier les
// listes de membres (owner en premier, puis director, etc.). Un rôle
// legacy/inconnu (migration pas encore appliquée) est relégué en dernier
// plutôt que de planter le tri.
const ROLE_ORDER: OrgRole[] = ['owner', 'director', 'stratege', 'monteur']

export function roleSortIndex(role: string): number {
  const i = ROLE_ORDER.indexOf(role as OrgRole)
  return i === -1 ? ROLE_ORDER.length : i
}

// Qui peut créer un nouveau client — owner/director uniquement. stratege/
// monteur restent en lecture seule.
const CLIENT_CREATOR_ROLES: OrgRole[] = ['owner', 'director']

export function canCreateClients(role: string): boolean {
  return CLIENT_CREATOR_ROLES.includes(role as OrgRole)
}

// Qui peut créer/assigner des tâches — owner/director uniquement.
// stratege/monteur voient leurs tâches et en changent le statut, mais n'en
// créent jamais.
const TASK_CREATOR_ROLES: OrgRole[] = ['owner', 'director']

export function canCreateTasks(role: string): boolean {
  return TASK_CREATOR_ROLES.includes(role as OrgRole)
}

// Qui voit/gère les finances (revenus, dépenses) — owner/director
// uniquement. Mirroir des policies RLS "revenues/expenses: director *"
// (supabase/migrations/047_finance_entries.sql) ; stratege/monteur n'ont
// aucun accès, ni API ni UI.
const FINANCE_ROLES: OrgRole[] = ['owner', 'director']

export function canViewFinance(role: string): boolean {
  return FINANCE_ROLES.includes(role as OrgRole)
}

// Connecter/déconnecter QuickBooks — propriétaire uniquement (c'est son
// compte Intuit qui est lié). director/stratege/monteur peuvent voir le
// statut et lancer une synchro (canViewFinance), jamais créer/révoquer la
// connexion elle-même.
export function canManageQuickBooksConnection(role: string): boolean {
  return role === 'owner'
}
