import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS } from '@/lib/plans'

export type OrgRole = 'owner' | 'manager' | 'editor' | 'viewer'
export type OrgPlan = 'free' | 'starter' | 'agence' | 'pro'
export { PLAN_LIMITS }

export interface OrgContext {
  userId:      string
  userName:    string
  userEmail:   string
  org:         { id: string; name: string; plan: OrgPlan; max_members: number; owner_id: string; created_at?: string; updated_at?: string } | null
  role:        OrgRole
  isOwner:     boolean
  canManageTeam:    boolean  // owner or manager
  canAccessFinance: boolean  // owner or manager
  canWrite:         boolean  // owner, manager, or editor
  dataOwnerId: string        // user_id to use for all data queries
  memberCount: number
}

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

    return {
      userId: user.id, userName, userEmail,
      org: org as OrgContext['org'],
      role: 'owner', isOwner: true,
      canManageTeam: true, canAccessFinance: true, canWrite: true,
      dataOwnerId: user.id,
      memberCount: count ?? 1,
    }
  }

  // 2 — Membre ?
  const { data: membership } = await supabase
    .from('org_members')
    .select('role, status, org:organizations(id, name, plan, max_members, owner_id)')
    .eq('user_id', user.id)
    .eq('status', 'actif')
    .single()

  if (membership) {
    const role    = membership.role as OrgRole
    const orgData = membership.org as unknown as OrgContext['org']
    return {
      userId: user.id, userName, userEmail,
      org: orgData,
      role, isOwner: false,
      canManageTeam:    role === 'manager',
      canAccessFinance: role === 'manager',
      canWrite:         role === 'manager' || role === 'editor',
      dataOwnerId: orgData?.owner_id ?? user.id,
      memberCount: 0,
    }
  }

  // 3 — Utilisateur solo (pas encore d'org)
  return {
    userId: user.id, userName, userEmail,
    org: null, role: 'owner', isOwner: true,
    canManageTeam: true, canAccessFinance: true, canWrite: true,
    dataOwnerId: user.id, memberCount: 1,
  }
}
