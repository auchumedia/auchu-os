import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import MonEspaceClient   from './MonEspaceClient'
import type { ClientCard } from './ClientGallery'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mon espace' }

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// clientIds === null : pas de filtrage (owner/director, tous les clients de
// l'org). clientIds === [...] : scopé à une équipe (chef_equipe/stratege/
// monteur, via team_clients).
async function fetchClientCards(supabase: SupabaseClient, ownerId: string, clientIds: string[] | null): Promise<ClientCard[]> {
  let query = supabase.from('clients').select('id, name, logo_url, status').eq('user_id', ownerId).order('name')
  if (clientIds) query = query.in('id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: clients } = await query
  const ids = (clients ?? []).map(c => c.id)

  const reviewCounts: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: reviewRows } = await supabase
      .from('content_pieces')
      .select('client_id')
      .eq('user_id', ownerId)
      .eq('status', 'review')
      .in('client_id', ids)
    for (const r of reviewRows ?? []) {
      if (r.client_id) reviewCounts[r.client_id] = (reviewCounts[r.client_id] ?? 0) + 1
    }
  }

  return (clients ?? []).map(c => ({ ...c, pendingReview: reviewCounts[c.id] ?? 0 }))
}

const TASK_PRIORITY_ORDER: Record<string, number> = { urgente: 0, haute: 1, normale: 2, basse: 3 }

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

  // ── Mes tâches — assignées à l'utilisateur connecté, toutes vues confondues.
  //    Triées par deadline côté requête (nulls en dernier), puis par priorité
  //    en JS (tri stable — préserve l'ordre de deadline au sein d'une priorité). ─
  const { data: assignedTasksRaw } = await supabase
    .from('tasks')
    .select('id, title, status, priority, deadline, client:clients(name)')
    .eq('user_id', ownerId)
    .eq('assigned_to', userId)
    .order('deadline', { ascending: true, nullsFirst: false })

  const assignedTasks = ((assignedTasksRaw ?? []) as any[])
    .slice()
    .sort((a, b) => (TASK_PRIORITY_ORDER[a.priority] ?? 2) - (TASK_PRIORITY_ORDER[b.priority] ?? 2))

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

    const clientCards = await fetchClientCards(supabase, ownerId, null)

    return (
      <MonEspaceClient
        view="owner"
        userName={ctx.userName}
        initialNote={note?.content ?? ''}
        todayTasks={todayTasks as any ?? []}
        toDelegate={toDelegate as any ?? []}
        clientCards={clientCards}
        initialClients={clientsForModal ?? []}
        assignedTasks={assignedTasks}
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
      // Pas d'embed profile:profiles(...) : dépend du cache de relations
      // PostgREST, qui peut rester périmé après une migration DDL (PGRST200).
      // Deux requêtes plates + fusion en JS, comme sur equipe/page.tsx.
      const [{ data: members }, { data: profiles }] = await Promise.all([
        supabase.from('org_members').select('user_id, role').eq('org_id', ctx.org?.id ?? '').in('user_id', memberUserIds),
        supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', memberUserIds),
      ])
      const profileByUserId = new Map((profiles ?? []).map(p => [p.id, p]))
      teamMembers = (members ?? []).map(m => ({ ...m, profile: profileByUserId.get(m.user_id) ?? null }))
    }
  }

  // ── Vue chef_equipe : son équipe, ses clients, tâches de ses membres ──────
  if (ctx.isTeamChef) {
    const clientIds = teamClientIds.length > 0 ? teamClientIds : ['00000000-0000-0000-0000-000000000000']

    const [clientCards, tasksRes] = await Promise.all([
      fetchClientCards(supabase, ownerId, teamClientIds),
      supabase.from('projects').select('id, title, status, priority, deadline, assigned_to, client:clients(name)')
        .eq('user_id', ownerId).in('client_id', clientIds).not('status', 'in', '(termine,annule)')
        .order('deadline', { ascending: true, nullsFirst: false }),
    ])

    return (
      <MonEspaceClient
        view="chef"
        userName={ctx.userName}
        teamMembers={teamMembers as any}
        clientCards={clientCards}
        teamTasks={tasksRes.data as any ?? []}
        initialClients={clientsForModal ?? []}
        assignedTasks={assignedTasks}
      />
    )
  }

  // ── Vue stratège : clients de l'équipe, livrables perso, calendrier équipe ─
  if (ctx.role === 'stratege') {
    const clientIds = teamClientIds.length > 0 ? teamClientIds : ['00000000-0000-0000-0000-000000000000']

    const [clientCards, myContentsRes, teamContentsRes] = await Promise.all([
      fetchClientCards(supabase, ownerId, teamClientIds),
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
        clientCards={clientCards}
        myContents={myContentsRes.data as any ?? []}
        teamContentCalendar={teamContentsRes.data as any ?? []}
        initialClients={clientsForModal ?? []}
        assignedTasks={assignedTasks}
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

  const clientCards = await fetchClientCards(supabase, ownerId, teamClientIds)

  return (
    <MonEspaceClient
      view="monteur"
      userName={ctx.userName}
      teamMembers={teamMembers as any}
      clientCards={clientCards}
      myTasks={myTasks as any ?? []}
      myContents={myContents as any ?? []}
      initialClients={clientsForModal ?? []}
      assignedTasks={assignedTasks}
    />
  )
}
