import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import FinanceModule from './FinanceModule'

export const metadata = { title: 'Finance' }

export default async function FinancePage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')
  // Owner : accès complet. Director : vue globale de l'agence (factures
  // membres + temps par membre notamment) — étendu ici, était owner-only.
  if (!ctx.isOwner && !ctx.isDirector) redirect('/dashboard')

  const supabase = await createClient()
  const ownerId  = ctx.dataOwnerId

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [
    { data: invoices },
    { data: expenses },
    { data: clients },
    { data: paidThisMonth },
    { data: expensesThisMonth },
    { data: pendingInvoices },
    { data: memberInvoicesRaw },
    { data: orgTasks },
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, client:clients(id, name, email, company)')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false }),

    supabase
      .from('expenses')
      .select('*, client:clients(id, name)')
      .eq('user_id', ownerId)
      .order('date', { ascending: false }),

    supabase
      .from('clients')
      .select('id, name, email')
      .eq('user_id', ownerId)
      .order('name'),

    supabase
      .from('invoices')
      .select('subtotal')
      .eq('user_id', ownerId)
      .eq('status', 'paye')
      .gte('paid_at', monthStart)
      .lte('paid_at', monthEnd),

    supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', ownerId)
      .gte('date', monthStart.split('T')[0])
      .lte('date', monthEnd.split('T')[0]),

    supabase
      .from('invoices')
      .select('total')
      .eq('user_id', ownerId)
      .in('status', ['envoye', 'en_retard']),

    ctx.org
      ? supabase
          .from('member_invoices')
          .select('*')
          .eq('org_id', ctx.org.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),

    supabase
      .from('tasks')
      .select('id, client_id, assigned_to, client:clients(name)')
      .eq('user_id', ownerId),
  ])

  const revenue       = (paidThisMonth ?? []).reduce((s, r) => s + (r.subtotal ?? 0), 0)
  const expensesTotal = (expensesThisMonth ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const pending       = (pendingInvoices ?? []).reduce((s, r) => s + (r.total ?? 0), 0)

  // ── Factures membres : profils non embarquables par FK (member_id → auth.users,
  //    pas profiles) — deuxième aller-retour ciblé, même raison que taches/page.tsx. ──
  const memberIds = Array.from(new Set((memberInvoicesRaw ?? []).map(m => m.member_id)))
  const { data: memberProfiles } = memberIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, email').in('id', memberIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] }
  const profileById = new Map((memberProfiles ?? []).map(p => [p.id, p]))

  const memberInvoices = (memberInvoicesRaw ?? []).map(inv => ({
    ...inv,
    member: profileById.get(inv.member_id)
      ? { id: inv.member_id, full_name: profileById.get(inv.member_id)!.full_name, email: profileById.get(inv.member_id)!.email }
      : null,
  }))

  // ── Vue temps par membre : entrées de temps de toutes les tâches de l'org ────
  const taskIds = (orgTasks ?? []).map(t => t.id)
  const clientByTask = new Map((orgTasks ?? []).map(t => [t.id, (t as any).client?.name ?? null]))

  let memberTimeEntries: {
    member_id: string; member_name: string
    client_id: string | null; client_name: string | null
    started_at: string; duration_seconds: number
  }[] = []

  if (taskIds.length > 0) {
    const { data: entries } = await supabase
      .from('time_entries')
      .select('task_id, user_id, client_id, started_at, duration_seconds')
      .in('task_id', taskIds)
      .not('duration_seconds', 'is', null)

    const entryUserIds = Array.from(new Set((entries ?? []).map(e => e.user_id)))
    const { data: entryProfiles } = entryUserIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email').in('id', entryUserIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] }
    const entryProfileById = new Map((entryProfiles ?? []).map(p => [p.id, p]))

    const { data: entryClients } = await supabase.from('clients').select('id, name').eq('user_id', ownerId)
    const clientNameById = new Map((entryClients ?? []).map(c => [c.id, c.name]))

    memberTimeEntries = (entries ?? []).map(e => ({
      member_id:   e.user_id,
      member_name: entryProfileById.get(e.user_id)?.full_name || entryProfileById.get(e.user_id)?.email || 'Membre',
      client_id:   e.client_id,
      client_name: e.client_id ? (clientNameById.get(e.client_id) ?? clientByTask.get(e.task_id) ?? null) : (clientByTask.get(e.task_id) ?? null),
      started_at:  e.started_at,
      duration_seconds: e.duration_seconds ?? 0,
    }))
  }

  return (
    <div className="space-y-6">
      <FinanceModule
        initialInvoices={invoices ?? []}
        initialExpenses={expenses ?? []}
        clients={clients ?? []}
        currentMonth={{
          revenue: Math.round(revenue * 100) / 100,
          expenses: Math.round(expensesTotal * 100) / 100,
          pending: Math.round(pending * 100) / 100,
          pendingCount: pendingInvoices?.length ?? 0,
        }}
        memberInvoices={memberInvoices as any}
        memberTimeEntries={memberTimeEntries}
      />
    </div>
  )
}
