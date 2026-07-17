import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { canCreateTasks } from '@/lib/roles'
import { notFound } from 'next/navigation'
import ClientDetail from './ClientDetail'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Fiche client' }

export default async function ClientPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const ctx = await getOrgContext()
  if (!ctx) notFound()

  const ownerId = ctx.dataOwnerId

  const [
    { data: client, error },
    { data: invoices },
    { data: content },
    { data: events },
    { data: tasks },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .single(),

    supabase
      .from('invoices')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false }),

    supabase
      .from('content_pieces')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', ownerId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false }),

    supabase
      .from('calendar_events')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', ownerId)
      .order('date', { ascending: true }),

    supabase
      .from('tasks')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false }),
  ])

  if (error || !client) notFound()

  // ── Membres de l'équipe (pour le champ "Assigné à" des concepts) ───────────
  let teamMembers: { id: string; name: string }[]
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

    teamMembers = (profiles ?? [])
      .map(p => ({ id: p.id, name: p.full_name || p.email || 'Membre' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } else {
    teamMembers = [{ id: ctx.userId, name: ctx.userName || ctx.userEmail }]
  }

  // ── Accès plateformes (sensible) — chargé uniquement pour owner/director,
  //    jamais présent dans les props d'un rôle non autorisé. ──────────────────
  const canManageSensitive = ctx.isOwner || ctx.isDirector
  let platformAccess = null
  if (canManageSensitive) {
    const { data } = await supabase
      .from('client_platform_access')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', ownerId)
      .maybeSingle()
    platformAccess = data
  }

  // ── Temps passé par l'équipe sur ce client ce mois — owner/director
  //    uniquement (mêmes lecteurs que "Rapports temps") : un chef_equipe/
  //    stratege/monteur n'a en RLS accès qu'à ses propres time_entries,
  //    donc un total "équipe" serait trompeur pour ces rôles. ────────────────
  let clientTimeThisMonth: { totalSeconds: number; byMember: { name: string; seconds: number }[] } | null = null
  if (canManageSensitive) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const { data: timeEntries } = await supabase
      .from('time_entries')
      .select('user_id, duration_seconds')
      .eq('client_id', params.id)
      .not('duration_seconds', 'is', null)
      .gte('started_at', monthStart)
      .lte('started_at', monthEnd)

    const memberIds = Array.from(new Set((timeEntries ?? []).map(e => e.user_id)))
    const { data: entryProfiles } = memberIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email').in('id', memberIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] }
    const profileById = new Map((entryProfiles ?? []).map(p => [p.id, p]))

    const secondsByMember = new Map<string, number>()
    for (const e of timeEntries ?? []) {
      secondsByMember.set(e.user_id, (secondsByMember.get(e.user_id) ?? 0) + (e.duration_seconds ?? 0))
    }

    clientTimeThisMonth = {
      totalSeconds: (timeEntries ?? []).reduce((s, e) => s + (e.duration_seconds ?? 0), 0),
      byMember: Array.from(secondsByMember.entries())
        .map(([id, seconds]) => ({ name: profileById.get(id)?.full_name || profileById.get(id)?.email || 'Membre', seconds }))
        .sort((a, b) => b.seconds - a.seconds),
    }
  }

  return (
    <ClientDetail
      client={client}
      invoices={invoices ?? []}
      content={content ?? []}
      events={events ?? []}
      tasks={tasks ?? []}
      teamMembers={teamMembers}
      canManageSensitive={canManageSensitive}
      canCreateTasks={canCreateTasks(ctx.role)}
      currentUserId={ctx.userId}
      platformAccess={platformAccess}
      clientTimeThisMonth={clientTimeThisMonth}
    />
  )
}
