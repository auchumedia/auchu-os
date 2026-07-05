import { createClient }   from '@/lib/supabase/server'
import { getOrgContext }  from '@/lib/org'
import { redirect }       from 'next/navigation'
import { canCreateTasks } from '@/lib/roles'
import TachesBoard         from './TachesBoard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tâches' }

const TASK_SELECT = 'id, title, description, status, priority, deadline, client_id, assigned_to, assigned_by, created_at, client:clients(id, name, company)'

export default async function TachesPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')

  const supabase = await createClient()
  const ownerId  = ctx.dataOwnerId

  // ── Membres assignables + clients liables, selon le rôle ──────────────────
  let members: { id: string; name: string }[] = []
  let clients: { id: string; name: string }[] = []

  if (ctx.isOwner || ctx.isDirector) {
    if (ctx.org) {
      const { data: orgMembersRaw } = await supabase
        .from('org_members')
        .select('user_id')
        .eq('org_id', ctx.org.id)
        .eq('status', 'actif')

      const memberIds = Array.from(new Set([ctx.org.owner_id, ...(orgMembersRaw ?? []).map(m => m.user_id)]))
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberIds)

      members = (profiles ?? [])
        .map(p => ({ id: p.id, name: p.full_name || p.email || 'Membre' }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } else {
      members = [{ id: ctx.userId, name: ctx.userName || ctx.userEmail }]
    }

    const { data: clientRows } = await supabase.from('clients').select('id, name').eq('user_id', ownerId).order('name')
    clients = clientRows ?? []
  } else if (ctx.isTeamChef) {
    if (ctx.teamId) {
      const { data: memberships } = await supabase
        .from('team_memberships')
        .select('user_id')
        .eq('team_id', ctx.teamId)

      const memberIds = (memberships ?? []).map(m => m.user_id)
      const { data: profiles } = memberIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('id', memberIds)
        : { data: [] as { id: string; full_name: string | null; email: string | null }[] }

      members = (profiles ?? [])
        .map(p => ({ id: p.id, name: p.full_name || p.email || 'Membre' }))
        .sort((a, b) => a.name.localeCompare(b.name))

      const { data: teamClientRows } = await supabase
        .from('team_clients')
        .select('client:clients(id, name)')
        .eq('team_id', ctx.teamId)

      clients = (teamClientRows ?? [])
        .map((r: any) => r.client)
        .filter(Boolean)
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
    }
  }

  // ── Tâches visibles — la RLS (migration 034) filtre déjà par rôle/équipe/
  //    assignation ; ce .eq('user_id', ownerId) documente juste le tenant. ────
  let tasksQuery = supabase.from('tasks').select(TASK_SELECT).eq('user_id', ownerId)
  if (!ctx.isOwner && !ctx.isDirector && !ctx.isTeamChef) {
    // stratege/monteur : uniquement leurs tâches assignées
    tasksQuery = tasksQuery.eq('assigned_to', ctx.userId)
  }
  const { data: tasks } = await tasksQuery.order('deadline', { ascending: true, nullsFirst: false })

  const view = ctx.isOwner || ctx.isDirector ? 'org' : ctx.isTeamChef ? 'team' : 'perso'

  // ── Time tracking : totaux accumulés (par tâche) + chrono actif de l'utilisateur ──
  const taskIds = (tasks ?? []).map(t => t.id)
  let timeTotals: Record<string, number> = {}
  if (taskIds.length > 0) {
    const { data: entries } = await supabase
      .from('time_entries')
      .select('task_id, duration_seconds')
      .in('task_id', taskIds)
      .not('duration_seconds', 'is', null)

    timeTotals = (entries ?? []).reduce((acc: Record<string, number>, e) => {
      acc[e.task_id] = (acc[e.task_id] ?? 0) + (e.duration_seconds ?? 0)
      return acc
    }, {})
  }

  // Le chrono actif lui-même (running/pausé) est chargé et géré globalement
  // par TimerContext (monté dans dashboard/layout.tsx) — pas besoin de le
  // refetch ici, seulement les totaux déjà accumulés ci-dessus.

  return (
    <div className="space-y-6">
      <TachesBoard
        view={view}
        currentUserId={ctx.userId}
        canCreate={canCreateTasks(ctx.role)}
        initialTasks={(tasks ?? []) as any}
        members={members}
        clients={clients}
        initialTimeTotals={timeTotals}
      />
    </div>
  )
}
