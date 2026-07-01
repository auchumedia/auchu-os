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
  const userId    = ctx.userId
  const ownerId   = ctx.dataOwnerId
  const today     = new Date().toISOString().split('T')[0]

  const { data: clientsForModal } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', ownerId)
    .order('name')

  if (ctx.isOwner) {
    // ── Vue owner ──────────────────────────────────────────────────────────

    const { data: note } = await supabase
      .from('user_notes')
      .select('content')
      .eq('user_id', userId)
      .maybeSingle()

    // Deadlines clients dues aujourd'hui ou en retard, toute l'agence
    const { data: todayTasks } = await supabase
      .from('projects')
      .select('id, title, priority, deadline, client:clients(name)')
      .eq('user_id', ownerId)
      .not('status', 'in', '(termine,annule)')
      .lte('deadline', today)
      .order('deadline', { ascending: true })
      .limit(15)

    // Tâches urgentes non assignées : à déléguer
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
        isOwner
        userName={ctx.userName}
        initialNote={note?.content ?? ''}
        todayTasks={todayTasks as any ?? []}
        toDelegate={toDelegate as any ?? []}
        initialClients={clientsForModal ?? []}
      />
    )
  }

  // ── Vue membre (manager / partner / editor / viewer) ────────────────────

  const { data: contents } = await supabase
    .from('content_pieces')
    .select('id, title, type, platform, status, scheduled_at, client_id, client:clients(name)')
    .eq('user_id', ownerId)
    .eq('assigned_user_id', userId)
    .not('status', 'in', '(approuve,publie)')
    .order('scheduled_at', { ascending: true, nullsFirst: false })

  const { data: myTasks } = await supabase
    .from('projects')
    .select('id, title, status, priority, deadline, client_id, client:clients(name)')
    .eq('user_id', ownerId)
    .eq('assigned_to', userId)
    .not('status', 'in', '(termine,annule)')
    .order('deadline', { ascending: true, nullsFirst: false })

  // Clients assignés : explicitement (partner) + dérivés des tâches/contenus assignés
  const { data: assignedPartnerClients } = ctx.isPartner
    ? await supabase.from('clients').select('id, name, company, status').eq('user_id', ownerId).eq('assigned_partner', userId)
    : { data: [] as { id: string; name: string; company: string | null; status: string }[] }

  const clientsById = new Map<string, { id: string; name: string }>()
  for (const row of assignedPartnerClients ?? []) clientsById.set(row.id, row)
  for (const t of [...(myTasks ?? []), ...(contents ?? [])]) {
    const c = t.client as unknown as { name: string } | null
    if (t.client_id && c?.name && !clientsById.has(t.client_id)) {
      clientsById.set(t.client_id, { id: t.client_id, name: c.name })
    }
  }
  const myClients = Array.from(clientsById.values())

  return (
    <MonEspaceClient
      isOwner={false}
      role={ctx.role}
      userName={ctx.userName}
      myTasks={myTasks as any ?? []}
      myContents={contents as any ?? []}
      myClients={myClients}
      initialClients={clientsForModal ?? []}
    />
  )
}
