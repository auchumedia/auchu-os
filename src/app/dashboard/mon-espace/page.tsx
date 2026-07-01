import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import MonEspaceClient   from './MonEspaceClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mon espace' }

export default async function MonEspacePage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')

  const supabase = await createClient()
  const userId  = ctx.userId
  const ownerId = ctx.dataOwnerId
  const today   = new Date().toISOString().split('T')[0]

  const { data: clientsForModal } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', ownerId)
    .order('name')

  // ── Vue owner + director : identique, vue d'ensemble de toute l'agence ────
  if (ctx.isOwner || ctx.isDirector) {
    const { data: note } = await supabase.from('user_notes').select('content').eq('user_id', userId).maybeSingle()

    const { data: todayTasks } = await supabase
      .from('projects')
      .select('id, title, priority, deadline, client:clients(name)')
      .eq('user_id', ownerId)
      .not('status', 'in', '(termine,annule)')
      .lte('deadline', today)
      .order('deadline', { ascending: true })
      .limit(15)

    const { data: toDelegate } = await supabase
      .from('projects')
      .select('id, title, priority, deadline, client:clients(name)')
      .eq('user_id', ownerId)
      .not('status', 'in', '(termine,annule)')
      .in('priority', ['haute', 'urgente'])
      .is('assigned_to', null)
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(15)

    return (
      <MonEspaceClient
        view="owner"
        userName={ctx.userName}
        initialNote={note?.content ?? ''}
        todayTasks={todayTasks as any ?? []}
        toDelegate={toDelegate as any ?? []}
        initialClients={clientsForModal ?? []}
      />
    )
  }

  // ── Roster de l'équipe (chef_equipe / stratege / monteur) ─────────────────
  let teamMembers: { user_id: string; role: string; profile: any }[] = []
  let teamClientIds: string[] = []
  if (ctx.teamId) {
    const [membershipsRes, clientsRes] = await Promise.all([
      supabase.from('team_memberships').select('user_id, role').eq('team_id', ctx.teamId),
      supabase.from('team_clients').select('client_id').eq('team_id', ctx.teamId),
    ])
    teamClientIds = (clientsRes.data ?? []).map(c => c.client_id)
    const memberUserIds = (membershipsRes.data ?? []).map(m => m.user_id)
    if (memberUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('org_members')
        .select('user_id, role, profile:profiles(full_name, email, avatar_url)')
        .eq('org_id', ctx.org?.id ?? '')
        .in('user_id', memberUserIds)
      teamMembers = profiles ?? []
    }
  }

  // ── Vue chef_equipe : son équipe, ses clients, tâches de ses membres ──────
  if (ctx.isTeamChef) {
    const clientIds = teamClientIds.length > 0 ? teamClientIds : ['00000000-0000-0000-0000-000000000000']

    const [clientsRes, tasksRes, contentsRes] = await Promise.all([
      supabase.from('clients').select('id, name, company, status').eq('user_id', ownerId).in('id', clientIds),
      supabase.from('projects').select('id, title, status, priority, deadline, assigned_to, client:clients(name)')
        .eq('user_id', ownerId).in('client_id', clientIds).not('status', 'in', '(termine,annule)')
        .order('deadline', { ascending: true, nullsFirst: false }),
      supabase.from('content_pieces').select('id, title, status, scheduled_at, assigned_user_id, client:clients(name)')
        .eq('user_id', ownerId).in('client_id', clientIds).not('status', 'in', '(approuve,publie)')
        .order('scheduled_at', { ascending: true, nullsFirst: false }),
    ])

    return (
      <MonEspaceClient
        view="chef"
        userName={ctx.userName}
        teamMembers={teamMembers as any}
        teamClients={clientsRes.data ?? []}
        teamTasks={tasksRes.data as any ?? []}
        teamContents={contentsRes.data as any ?? []}
        initialClients={clientsForModal ?? []}
      />
    )
  }

  // ── Vue stratège : clients de l'équipe, livrables perso, calendrier équipe ─
  if (ctx.role === 'stratege') {
    const clientIds = teamClientIds.length > 0 ? teamClientIds : ['00000000-0000-0000-0000-000000000000']

    const [clientsRes, myContentsRes, teamContentsRes] = await Promise.all([
      supabase.from('clients').select('id, name, company, status').eq('user_id', ownerId).in('id', clientIds),
      supabase.from('content_pieces').select('id, title, status, scheduled_at, client:clients(name)')
        .eq('user_id', ownerId).eq('assigned_user_id', userId).not('status', 'in', '(approuve,publie)')
        .order('scheduled_at', { ascending: true, nullsFirst: false }),
      supabase.from('content_pieces').select('id, title, status, scheduled_at, client:clients(name)')
        .eq('user_id', ownerId).in('client_id', clientIds).not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: true })
        .limit(20),
    ])

    return (
      <MonEspaceClient
        view="stratege"
        userName={ctx.userName}
        teamMembers={teamMembers as any}
        teamClients={clientsRes.data ?? []}
        myContents={myContentsRes.data as any ?? []}
        teamContentCalendar={teamContentsRes.data as any ?? []}
        initialClients={clientsForModal ?? []}
      />
    )
  }

  // ── Vue monteur : projets/contenus assignés, roster de l'équipe ───────────
  const { data: myContents } = await supabase
    .from('content_pieces')
    .select('id, title, type, platform, status, scheduled_at, client:clients(name)')
    .eq('user_id', ownerId)
    .eq('assigned_user_id', userId)
    .not('status', 'in', '(approuve,publie)')
    .order('scheduled_at', { ascending: true, nullsFirst: false })

  const { data: myTasks } = await supabase
    .from('projects')
    .select('id, title, status, priority, deadline, client:clients(name)')
    .eq('user_id', ownerId)
    .eq('assigned_to', userId)
    .not('status', 'in', '(termine,annule)')
    .order('deadline', { ascending: true, nullsFirst: false })

  return (
    <MonEspaceClient
      view="monteur"
      userName={ctx.userName}
      teamMembers={teamMembers as any}
      myTasks={myTasks as any ?? []}
      myContents={myContents as any ?? []}
      initialClients={clientsForModal ?? []}
    />
  )
}
