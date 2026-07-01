import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS } from '@/lib/plans'
import type { OrgRole, OrgPlan } from '@/types'

export type { OrgRole, OrgPlan }
export { PLAN_LIMITS }

export interface OrgContext {
  userId:      string
  userName:    string
  userEmail:   string
  org:         { id: string; name: string; plan: OrgPlan; max_members: number; owner_id: string; created_at?: string; updated_at?: string } | null
  role:        OrgRole
  isOwner:     boolean
  isDirector:  boolean
  isTeamChef:  boolean
  canManageTeamRoles:    boolean
  canManageOrgStructure: boolean
  canAccessFinance:      boolean
  dataOwnerId: string
  teamId:      string | null
  memberCount: number
}

const OWNER_EMAIL = 'raphael@auchumedia.com'

export async function getOrgContext(): Promise<OrgContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const userName  = user.user_metadata?.full_name  || user.email?.split('@')[0] || ''
  const userEmail = user.email || ''

  // ── 1. Membre non-owner (priorité sur la propriété) ────────────────────────
  // Si l'utilisateur a été invité dans une org tierce (role != 'owner'),
  // on utilise ce contexte même s'il possède aussi sa propre org.
  const { data: membership, error: memberErr } = await supabase
    .from('org_members')
    .select('role, status, org:organizations(id, name, plan, max_members, owner_id)')
    .eq('user_id', user.id)
    .eq('status', 'actif')
    .neq('role', 'owner')
    .limit(1)
    .maybeSingle()

  if (memberErr) {
    console.error('[getOrgContext] erreur membership:', memberErr.code, memberErr.message)
  }

  if (membership) {
    const role    = membership.role as OrgRole
    const orgData = membership.org as unknown as OrgContext['org']
    const isDirector = role === 'director'
    const isTeamChef = role === 'chef_equipe'

    // team_memberships n'a pas de FK directe vers org_members (les deux ne
    // référencent que auth.users) — PostgREST ne peut pas l'embarquer dans
    // la requête ci-dessus, d'où ce second aller-retour ciblé.
    let teamId: string | null = null
    if (role === 'chef_equipe' || role === 'stratege' || role === 'monteur') {
      const { data: teamMembership } = await supabase
        .from('team_memberships')
        .select('team_id')
        .eq('user_id', user.id)
        .maybeSingle()
      teamId = teamMembership?.team_id ?? null
    }

    return {
      userId: user.id, userName, userEmail,
      org: orgData,
      role, isOwner: false, isDirector, isTeamChef,
      canManageTeamRoles:    isDirector || isTeamChef,
      canManageOrgStructure: isDirector,
      canAccessFinance:      false,
      dataOwnerId: orgData?.owner_id ?? user.id,
      teamId,
      memberCount: 0,
    }
  }

  // ── 2. Propriétaire ────────────────────────────────────────────────────────
  // Seulement si pas de membership non-owner trouvé.
  const { data: ownedOrg, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, plan, max_members, owner_id')
    .eq('owner_id', user.id)
    .maybeSingle()   // était .single() — PGRST116 si 0 ou 2+ orgs

  if (orgErr) {
    console.error('[getOrgContext] erreur org owner:', orgErr.code, orgErr.message)
  }

  if (ownedOrg) {
    const { count } = await supabase
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', ownedOrg.id)
      .eq('status', 'actif')

    const effectiveOrg = userEmail === OWNER_EMAIL
      ? { ...ownedOrg, plan: 'pro' as OrgPlan, max_members: 999 }
      : ownedOrg as OrgContext['org']

    return {
      userId: user.id, userName, userEmail,
      org: effectiveOrg,
      role: 'owner', isOwner: true, isDirector: false, isTeamChef: false,
      canManageTeamRoles: true, canManageOrgStructure: true, canAccessFinance: true,
      dataOwnerId: user.id,
      teamId: null,
      memberCount: count ?? 1,
    }
  }

  // ── 3. Utilisateur solo (pas encore d'org, pas de membership) ─────────────
  return {
    userId: user.id, userName, userEmail,
    org: null, role: 'owner', isOwner: true, isDirector: false, isTeamChef: false,
    canManageTeamRoles: true, canManageOrgStructure: true, canAccessFinance: true,
    dataOwnerId: user.id, teamId: null, memberCount: 1,
  }
}
