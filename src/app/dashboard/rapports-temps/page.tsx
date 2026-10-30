import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import RapportsTempsClient from './RapportsTempsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Rapports temps' }

export default async function RapportsTempsPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')
  if (!ctx.isOwner && !ctx.isDirector) redirect('/dashboard')

  const supabase = await createClient()
  const ownerId  = ctx.dataOwnerId

  // ── Membres de l'org (pour le filtre "Membre") ─────────────────────────────
  let members: { id: string; name: string }[]
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

  // ── Clients (pour le filtre "Client") ───────────────────────────────────────
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', ownerId)
    .order('name')

  // ── Tâches de l'org (pour résoudre titre + client des entrées de temps) ────
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, client_id, client:clients(name)')
    .eq('user_id', ownerId)

  const taskById = new Map((tasks ?? []).map(t => [t.id, t]))
  const taskIds = (tasks ?? []).map(t => t.id)

  // ── Entrées de temps de toute l'org ─────────────────────────────────────────
  let entries: {
    id: string
    member_id: string; member_name: string
    client_id: string | null; client_name: string | null
    task_id: string; task_title: string
    started_at: string; duration_seconds: number
  }[] = []

  if (taskIds.length > 0) {
    const { data: timeEntries } = await supabase
      .from('time_entries')
      .select('id, task_id, user_id, client_id, started_at, duration_seconds')
      .in('task_id', taskIds)
      .not('duration_seconds', 'is', null)

    const entryUserIds = Array.from(new Set((timeEntries ?? []).map(e => e.user_id)))
    const { data: entryProfiles } = entryUserIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email').in('id', entryUserIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] }
    const profileById = new Map((entryProfiles ?? []).map(p => [p.id, p]))

    const clientNameById = new Map((clients ?? []).map(c => [c.id, c.name]))

    entries = (timeEntries ?? []).map(e => {
      const task = taskById.get(e.task_id) as any
      const clientId = e.client_id ?? task?.client_id ?? null
      return {
        id: e.id,
        member_id:   e.user_id,
        member_name: profileById.get(e.user_id)?.full_name || profileById.get(e.user_id)?.email || 'Membre',
        client_id:   clientId,
        client_name: clientId ? (clientNameById.get(clientId) ?? task?.client?.name ?? null) : null,
        task_id:     e.task_id,
        task_title:  task?.title ?? 'Tâche supprimée',
        started_at:  e.started_at,
        duration_seconds: e.duration_seconds ?? 0,
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Rapports temps</h1>
        <p className="text-sm text-gray-500 mt-0.5">Temps tracké par l'équipe, par membre, client et tâche</p>
      </div>
      <RapportsTempsClient
        entries={entries}
        members={members}
        clients={clients ?? []}
      />
    </div>
  )
}
