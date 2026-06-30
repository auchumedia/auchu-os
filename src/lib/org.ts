import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS } from '@/lib/plans'

export type OrgRole = 'owner' | 'manager' | 'partner' | 'editor' | 'viewer'
export type OrgPlan = 'free' | 'starter' | 'agence' | 'pro'
export { PLAN_LIMITS }

export interface OrgContext {
  userId:      string
  userName:    string
  userEmail:   string
  org:         { id: string; name: string; plan: OrgPlan; max_members: number; owner_id: string; created_at?: string; updated_at?: string } | null
  role:        OrgRole
  isOwner:     boolean
  isPartner:   boolean
  canManageTeam:    boolean  // owner or manager
  canAccessFinance: boolean  // owner or manager
  canWrite:         boolean  // owner, manager, partner, or editor
  dataOwnerId: string        // user_id to use for all data queries
  memberCount: number
}

const OWNER_EMAIL = 'raphael@auchumedia.com'

export async function getOrgContext(): Promise<OrgContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const userName  = user.user_metadata?.full_name  || user.email?.split('@')[0] || ''
  const userEmail = user.email || ''

  // 1 — Propriétaire ?
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, plan, max_members, owner_id')
    .eq('owner_id', user.id)
    .single()

  if (org) {
    const { count } = await supabase
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('status', 'actif')

    // Compte owner gratuit : toujours plan Pro sans restriction
    const effectiveOrg = userEmail === OWNER_EMAIL
      ? { ...org, plan: 'pro' as OrgPlan, max_members: 999 }
      : org as OrgContext['org']

    return {
      userId: user.id, userName, userEmail,
      org: effectiveOrg,
      role: 'owner', isOwner: true, isPartner: false,
      canManageTeam: true, canAccessFinance: true, canWrite: true,
      dataOwnerId: user.id,
      memberCount: count ?? 1,
    }
  }

  // 2 — Membre ?
  // .limit(1).maybeSingle() au lieu de .single() : évite PGRST116 si 0 lignes
  // (utilisateur pas encore dans org_members) ou si doublons (race condition
  // entre callback email et joinWithExistingAccount).
  const { data: membership } = await supabase
    .from('org_members')
    .select('role, status, org:organizations(id, name, plan, max_members, owner_id)')
    .eq('user_id', user.id)
    .eq('status', 'actif')
    .limit(1)
    .maybeSingle()

  if (membership) {
    const role    = membership.role as OrgRole
    const orgData = membership.org as unknown as OrgContext['org']
    const isPartner = role === 'partner'

    console.log('[getOrgContext] membre — role:', role, '| orgData.owner_id:', orgData?.owner_id ?? 'NULL')

    return {
      userId: user.id, userName, userEmail,
      org: orgData,
      role, isOwner: false, isPartner,
      canManageTeam:    role === 'manager',
      canAccessFinance: role === 'manager',
      canWrite:         role === 'manager' || role === 'partner' || role === 'editor',
      // dataOwnerId : toujours l'owner de l'org pour que les queries de données
      // (clients, projets...) ciblent les bonnes lignes
      dataOwnerId: orgData?.owner_id ?? user.id,
      memberCount: 0,
    }
  }

  // 3 — Utilisateur solo (pas encore d'org)
  return {
    userId: user.id, userName, userEmail,
    org: null, role: 'owner', isOwner: true, isPartner: false,
    canManageTeam: true, canAccessFinance: true, canWrite: true,
    dataOwnerId: user.id, memberCount: 1,
  }
}
