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
    .select('role, status, org_id, org:organizations(id, name, plan, max_members, owner_id)')
    .eq('user_id', user.id)
    .eq('status', 'actif')
    .neq('role', 'owner')
    .limit(1)
    .maybeSingle()

  if (memberErr) {
    console.error('[getOrgContext] erreur membership:', memberErr.code, memberErr.message)
  }
  console.log('[getOrgContext] membership query —', 'user:', user.id, '| found:', !!membership, '| role:', membership?.role, '| org_id:', membership?.org_id, '| org embed:', membership?.org ? 'ok' : 'null')

  // Ignore une ligne org_members non-owner si elle pointe vers l'org que
  // l'utilisateur possède lui-même (artefact de données — ex: une invitation
  // acceptée par erreur avec son propre compte). Sinon il serait traité comme
  // simple membre de sa propre agence : isOwner=false, facturation masquée,
  // etc. La priorité "membership" ne doit s'appliquer qu'à une AUTRE org.
  const isSelfOwnedAnomaly = !!membership && (membership.org as unknown as OrgContext['org'])?.owner_id === user.id
  if (isSelfOwnedAnomaly) {
    console.error('[getOrgContext] org_members anomaly ignorée — user_id:', user.id, '| role:', membership!.role, '| org_id:', (membership!.org as any)?.id, '(cet utilisateur possède cette org mais a aussi une ligne org_members non-owner dessus)')
  }

  if (membership && !isSelfOwnedAnomaly) {
    const role    = membership.role as OrgRole
    let orgData = membership.org as unknown as OrgContext['org']
    const isDirector = role === 'director'
    const isTeamChef = role === 'chef_equipe'

    // L'embed PostgREST org:organizations(...) ci-dessus dépend de la policy
    // RLS "org: member read" (id in my_org_ids()) pour résoudre la relation.
    // S'il échoue à matcher pour une raison quelconque (cache de schéma,
    // policy pas encore appliquée sur ce projet Supabase, etc.), l'embed
    // renvoie silencieusement `org: null` sans erreur PostgREST — et
    // `orgData?.owner_id ?? user.id` retombait alors sur l'ID du membre
    // lui-même. Comme content_pieces.user_id (et toutes les autres tables
    // de data) contient TOUJOURS l'ID du owner, jamais celui du membre, un
    // dataOwnerId erroné casse silencieusement tout PATCH pour ce membre
    // (0 ligne ne matche jamais .eq('user_id', dataOwnerId)).
    // my_org_owner_ids() est SECURITY DEFINER : il lit org_members/organizations
    // sans passer par RLS et sert donc de filet de sécurité indépendant de
    // l'embed, pour n'importe quel rôle et n'importe quelle organisation.
    const { data: ownerIdsRpc, error: ownerIdsErr } = await supabase.rpc('my_org_owner_ids')
    const rpcOwnerId: string | undefined = Array.isArray(ownerIdsRpc) ? ownerIdsRpc[0] : undefined

    if (ownerIdsErr) {
      console.error('[getOrgContext] erreur rpc my_org_owner_ids —', 'user:', user.id, '| role:', role, '| code:', ownerIdsErr.code, '| message:', ownerIdsErr.message)
    }

    // Si l'embed a échoué mais que le RPC a résolu owner_id, retente une
    // lecture directe (non imbriquée) de organizations — un échec d'embed
    // PostgREST (cache de schéma / FK ambiguë) n'implique pas forcément un
    // échec de la policy RLS elle-même sur une requête simple.
    if (!orgData && rpcOwnerId) {
      const { data: directOrg } = await supabase
        .from('organizations')
        .select('id, name, plan, max_members, owner_id')
        .eq('id', membership.org_id)
        .maybeSingle()
      if (directOrg) orgData = directOrg as OrgContext['org']
    }

    const dataOwnerId = orgData?.owner_id ?? rpcOwnerId ?? user.id

    if (dataOwnerId === user.id) {
      console.error('[getOrgContext] ⚠️ dataOwnerId retombe sur user.id pour un membre non-owner —', 'user:', user.id, '| role:', role, '| org_id:', membership.org_id, '| embed owner_id:', orgData?.owner_id, '| rpc owner_id:', rpcOwnerId, '→ tout PATCH/DELETE filtré sur dataOwnerId va échouer silencieusement pour ce membre')
    } else if (!orgData?.owner_id) {
      console.warn('[getOrgContext] embed organizations vide, owner_id résolu via rpc fallback —', 'user:', user.id, '| role:', role, '| org_id:', membership.org_id, '| owner_id (rpc):', rpcOwnerId)
    }

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
      dataOwnerId,
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
