import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import { roleSortIndex } from '@/lib/roles'
import EquipeClient      from './EquipeClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Équipe' }

const TEAM_SELECT = `
  id, org_id, name, chef_id, created_at, updated_at,
  members:team_memberships(id, user_id, role, joined_at),
  clients:team_clients(id, client_id, assigned_at, client:clients(id, name, company, status))
`

export default async function EquipePage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')

  if (!ctx.org) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Équipe</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez les membres de votre organisation</p>
        </div>
        <div className="card text-center py-16 space-y-3">
          <p className="text-gray-400">Vous n'avez pas encore d'organisation.</p>
          <p className="text-sm text-gray-400">
            Créez votre agence depuis <a href="/settings" className="text-auchu-600 underline">Paramètres</a>.
          </p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  // ── Roster complet de l'org (id/role/status) — "org_members: member reads
  //    roster" autorise déjà tout membre actif à lire l'ensemble, la RLS des
  //    tables enfants (teams/clients) fait le vrai filtrage par équipe.
  //    Profils récupérés séparément (pas d'embed profile:profiles(...) ici) :
  //    l'embed PostgREST dépend du cache de relations du schéma, qui peut
  //    rester périmé après une migration DDL (create table/policy/function)
  //    et faire échouer silencieusement la requête (PGRST200) — vu en
  //    production juste après les migrations 021/022/023. Deux requêtes
  //    plates + fusion en JS n'ont pas cette dépendance. ─────────────────────
  const { data: orgMembersRaw, error: orgMembersErr } = await supabase
    .from('org_members')
    .select('id, user_id, role, status')
    .eq('org_id', ctx.org.id)
    .eq('status', 'actif')

  if (orgMembersErr) console.error('[equipe] orgMembersRaw query error:', orgMembersErr.code, orgMembersErr.message)

  const memberUserIds = (orgMembersRaw ?? []).map(m => m.user_id)
  const { data: memberProfiles, error: profilesErr } = memberUserIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', memberUserIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[], error: null }

  if (profilesErr) console.error('[equipe] memberProfiles query error:', profilesErr.code, profilesErr.message)

  const profileByUserId = new Map((memberProfiles ?? []).map(p => [p.id, p]))
  const orgMembersAll = (orgMembersRaw ?? [])
    .map(m => ({ ...m, profile: profileByUserId.get(m.user_id) ?? null }))
    .sort((a, b) => roleSortIndex(a.role) - roleSortIndex(b.role))

  const orgMemberByUserId = new Map(orgMembersAll.map(m => [m.user_id, m]))

  // ── Équipes visibles selon le rôle ────────────────────────────────────────
  let teamsQuery = supabase.from('teams').select(TEAM_SELECT).order('created_at', { ascending: true })
  teamsQuery = ctx.canManageOrgStructure
    ? teamsQuery.eq('org_id', ctx.org.id)
    : teamsQuery.eq('id', ctx.teamId ?? '00000000-0000-0000-0000-000000000000')

  const { data: teamsData, error: teamsErr } = await teamsQuery
  if (teamsErr) console.error('[equipe] teams query error:', teamsErr.code, teamsErr.message)

  const teams = (teamsData ?? []).map(t => ({
    ...t,
    members: (t.members ?? [])
      .map((tm: any) => {
        const om = orgMemberByUserId.get(tm.user_id)
        if (!om) return null // membre désactivé/retiré entre-temps
        return { id: om.id, user_id: tm.user_id, role: om.role, status: om.status, joined_at: tm.joined_at, profile: om.profile }
      })
      .filter(Boolean),
  }))

  // ── Invitations en attente ────────────────────────────────────────────────
  let invitesQuery = supabase
    .from('invitations')
    .select('id, code, role, team_id, expires_at, created_at, invited_name, invited_email')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  invitesQuery = ctx.canManageOrgStructure
    ? invitesQuery.eq('org_id', ctx.org.id)
    : ctx.isTeamChef
      ? invitesQuery.eq('team_id', ctx.teamId ?? '00000000-0000-0000-0000-000000000000')
      : invitesQuery.eq('id', '00000000-0000-0000-0000-000000000000') // stratege/monteur : pas d'invitations

  const { data: invitesData } = await invitesQuery

  // ── Membres et clients non assignés à une équipe — owner/director uniquement
  let unassignedMembers: typeof orgMembersAll = []
  let unassignedClients: { id: string; name: string }[] = []
  let workload: Record<string, number> = {}

  if (ctx.canManageOrgStructure) {
    const teamUserIds   = new Set(teams.flatMap(t => t.members.map((m: any) => m.user_id)))
    const teamClientIds = new Set(teams.flatMap(t => (t.clients ?? []).map((c: any) => c.client_id)))

    const [clientsRes, contentRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name')
        .eq('user_id', ctx.dataOwnerId)
        .order('name'),
      supabase
        .from('content_pieces')
        .select('assigned_user_id')
        .eq('user_id', ctx.dataOwnerId)
        .not('assigned_user_id', 'is', null)
        .not('status', 'in', '(approuve,publie,refuse)'),
    ])

    unassignedMembers = (orgMembersAll ?? []).filter(
      m => ['chef_equipe', 'stratege', 'monteur'].includes(m.role) && !teamUserIds.has(m.user_id)
    )
    unassignedClients = (clientsRes.data ?? []).filter(c => !teamClientIds.has(c.id))

    for (const c of contentRes.data ?? []) {
      if (c.assigned_user_id) workload[c.assigned_user_id] = (workload[c.assigned_user_id] ?? 0) + 1
    }
  }

  // ── Candidats chef_equipe pour la création d'équipe : ont déjà le rôle mais
  //    ne dirigent pas encore d'équipe ────────────────────────────────────────
  const chefCandidates = (unassignedMembers ?? []).filter(m => m.role === 'chef_equipe')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Équipe</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez les équipes de {ctx.org.name}</p>
      </div>
      <EquipeClient
        role={ctx.role}
        currentUserId={ctx.userId}
        canManageOrgStructure={ctx.canManageOrgStructure}
        isTeamChef={ctx.isTeamChef}
        org={ctx.org}
        activeMemberCount={(orgMembersAll ?? []).length}
        allMembers={ctx.canManageOrgStructure ? ((orgMembersAll ?? []) as any) : []}
        teams={teams as any}
        invitations={(invitesData ?? []) as any}
        unassignedMembers={(unassignedMembers ?? []) as any}
        unassignedClients={unassignedClients}
        chefCandidates={chefCandidates as any}
        workload={workload}
      />
    </div>
  )
}
