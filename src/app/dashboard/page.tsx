import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import Link              from 'next/link'
import {
  Users, FileText, Receipt, ListChecks, AlertTriangle,
  CalendarDays, Clock,
} from 'lucide-react'
import ClientGallery, { type ClientCard } from '@/components/dashboard/ClientGallery'
import TasksTodayList from './TasksTodayList'
import { cn, formatDate, formatCurrency, PRIORITY_LABELS } from '@/lib/utils'
import type { TaskPriority } from '@/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tableau de bord' }

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const TASK_PRIORITY_ORDER: Record<string, number> = { urgente: 0, haute: 1, normale: 2, basse: 3 }
const PRIORITY_DOT: Record<TaskPriority, string> = {
  basse: 'bg-gray-300', normale: 'bg-blue-400', haute: 'bg-amber-400', urgente: 'bg-red-500',
}

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

export default async function DashboardPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')

  const supabase = await createClient()
  const ownerId  = ctx.dataOwnerId
  const userId   = ctx.userId
  const firstName = (ctx.userName || ctx.userEmail).split(' ')[0].split('@')[0]
  const isOrgView = ctx.isOwner || ctx.isDirector

  const now      = new Date()
  const todayISO = now.toISOString().split('T')[0]
  const dateStr  = now.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="-mx-4 md:-mx-6 -mt-6 md:-mt-8 -mb-24 md:-mb-8 px-4 md:px-6 pt-6 md:pt-8 pb-24 md:pb-8 bg-[#f8fafc]">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Bonjour {firstName} 👋</h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">{dateStr}</p>
        </div>

        {isOrgView
          ? await OrgDashboard(supabase, ctx, ownerId, todayISO)
          : await TeamDashboard(supabase, ctx, ownerId, userId, now, todayISO)}
      </div>
    </div>
  )
}

// ─── Vue owner / director ────────────────────────────────────────────────────

async function OrgDashboard(
  supabase: SupabaseClient,
  ctx: NonNullable<Awaited<ReturnType<typeof getOrgContext>>>,
  ownerId: string,
  todayISO: string,
) {
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [
    clientsRes, reviewCountRes, overdueCountRes, activeTasksCountRes,
    revenueRes, clientCards, urgentTasksRes, recentContentRes,
  ] = await Promise.all([
    supabase.from('clients').select('id, status').eq('user_id', ownerId),
    supabase.from('content_pieces').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'review'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).lt('deadline', todayISO).not('status', 'in', '(termine,approuve)'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'en_cours'),
    ctx.canAccessFinance
      ? supabase.from('invoices').select('subtotal').eq('user_id', ownerId).eq('status', 'paye').gte('paid_at', monthStart).lte('paid_at', monthEnd)
      : Promise.resolve({ data: null as { subtotal: number }[] | null }),
    fetchClientCards(supabase, ownerId, null),
    supabase.from('tasks')
      .select('id, title, priority, deadline, assigned_to, client:clients(name)')
      .eq('user_id', ownerId)
      .not('status', 'in', '(termine,approuve)')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(30),
    supabase.from('content_pieces')
      .select('id, title, status, client:clients(name)')
      .eq('user_id', ownerId)
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  const clientsActifs   = (clientsRes.data ?? []).filter(c => c.status === 'actif').length
  const aApprouver      = reviewCountRes.count ?? 0
  const enRetard        = overdueCountRes.count ?? 0
  const revenue         = (revenueRes.data ?? []).reduce((s, r) => s + (r.subtotal ?? 0), 0)

  // ── Noms des assignés (org_members + profiles, résolution à plat) ─────────
  const assignedIds = Array.from(new Set((urgentTasksRes.data ?? []).map((t: any) => t.assigned_to).filter(Boolean)))
  const memberName = new Map<string, string>()
  if (assignedIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', assignedIds)
    for (const p of profiles ?? []) memberName.set(p.id, p.full_name || p.email || 'Membre')
  }

  const urgentTasks = ((urgentTasksRes.data ?? []) as any[])
    .slice()
    .sort((a, b) => (TASK_PRIORITY_ORDER[a.priority] ?? 2) - (TASK_PRIORITY_ORDER[b.priority] ?? 2))
    .slice(0, 5)

  const stats = [
    { label: 'Clients actifs',       value: clientsActifs, icon: Users,       color: 'text-blue-600 bg-blue-50',     href: '/dashboard/clients' },
    { label: 'À approuver',          value: aApprouver,    icon: FileText,    color: 'text-purple-600 bg-purple-50', href: '/dashboard/clients' },
    { label: 'Tâches en retard',     value: enRetard,      icon: AlertTriangle, color: 'text-red-600 bg-red-50',     href: '/dashboard/taches'  },
    ctx.canAccessFinance
      ? { label: 'Revenus du mois',  value: formatCurrency(revenue), icon: Receipt, color: 'text-green-600 bg-green-50', href: '/dashboard/finance' }
      : { label: 'Tâches actives',   value: activeTasksCountRes.count ?? 0, icon: ListChecks, color: 'text-indigo-600 bg-indigo-50', href: '/dashboard/taches' },
  ]

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <Link
              key={s.label}
              href={s.href}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-all hover:shadow-md"
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', s.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </Link>
          )
        })}
      </div>

      {/* Galerie clients */}
      <ClientGallery title="Clients" clients={clientCards} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tâches urgentes */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-auchu-500" />
            <h2 className="font-semibold text-gray-900">Tâches urgentes</h2>
            <Link href="/dashboard/taches" className="text-xs text-auchu-600 hover:underline ml-auto">Voir tout</Link>
          </div>
          {urgentTasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-10">
              <p className="text-sm text-gray-400">Aucune tâche urgente pour l'instant.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {urgentTasks.map((t: any) => {
                const isOverdue = !!t.deadline && new Date(t.deadline) < now
                return (
                  <div key={t.id} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOT[t.priority as TaskPriority] ?? PRIORITY_DOT.normale)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {t.assigned_to ? memberName.get(t.assigned_to) ?? 'Membre' : 'Non assigné'}
                        {t.client?.name ? ` · ${t.client.name}` : ''}
                      </p>
                    </div>
                    {t.priority !== 'normale' && (
                      <span className="hidden sm:inline text-xs font-medium text-gray-400 flex-shrink-0">
                        {PRIORITY_LABELS[t.priority]}
                      </span>
                    )}
                    {t.deadline && (
                      <span className={cn('text-xs flex-shrink-0', isOverdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
                        {formatDate(t.deadline)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Activité récente */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-auchu-500" />
            <h2 className="font-semibold text-gray-900">Activité récente</h2>
          </div>
          {!recentContentRes.data || recentContentRes.data.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-10">
              <p className="text-sm text-gray-400">Aucun contenu modifié récemment.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {recentContentRes.data.map((piece: any) => (
                <div key={piece.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{piece.title}</p>
                    <p className="text-xs text-gray-400">{piece.client?.name}</p>
                  </div>
                  <span className={cn('badge text-xs flex-shrink-0',
                    piece.status === 'publie'   ? 'badge-green' :
                    piece.status === 'approuve' ? 'badge-green' :
                    piece.status === 'review'   ? 'badge-amber' :
                    piece.status === 'pret'     ? 'badge-blue'  : 'badge-gray'
                  )}>
                    {piece.status === 'publie'       ? 'Publié'    :
                     piece.status === 'approuve'     ? 'Approuvé'  :
                     piece.status === 'review'       ? 'À réviser' :
                     piece.status === 'pret'         ? 'Prêt'      :
                     piece.status === 'en_redaction' ? 'En cours'  : piece.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

// ─── Vue chef_equipe / stratège / monteur ────────────────────────────────────

async function TeamDashboard(
  supabase: SupabaseClient,
  ctx: NonNullable<Awaited<ReturnType<typeof getOrgContext>>>,
  ownerId: string,
  userId: string,
  now: Date,
  todayISO: string,
) {
  let teamClientIds: string[] = []
  if (ctx.teamId) {
    const { data: tc } = await supabase.from('team_clients').select('client_id').eq('team_id', ctx.teamId)
    teamClientIds = (tc ?? []).map(c => c.client_id)
  }

  const in7Days = new Date(now)
  in7Days.setDate(in7Days.getDate() + 6)
  const in7DaysISO = in7Days.toISOString().split('T')[0]

  const [clientCards, myTasksRes, weekTasksRes] = await Promise.all([
    fetchClientCards(supabase, ownerId, teamClientIds),
    supabase.from('tasks')
      .select('id, title, status, priority, deadline, client:clients(name)')
      .eq('user_id', ownerId)
      .eq('assigned_to', userId)
      .not('status', 'in', '(termine,approuve)')
      .order('deadline', { ascending: true, nullsFirst: false }),
    supabase.from('tasks')
      .select('deadline')
      .eq('user_id', ownerId)
      .eq('assigned_to', userId)
      .not('deadline', 'is', null)
      .gte('deadline', todayISO)
      .lte('deadline', in7DaysISO),
  ])

  const myTasks = ((myTasksRes.data ?? []) as any[])
    .slice()
    .sort((a, b) => (TASK_PRIORITY_ORDER[a.priority] ?? 2) - (TASK_PRIORITY_ORDER[b.priority] ?? 2))

  const countByDate = new Map<string, number>()
  for (const t of weekTasksRes.data ?? []) {
    if (t.deadline) countByDate.set(t.deadline, (countByDate.get(t.deadline) ?? 0) + 1)
  }
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().split('T')[0]
    return {
      iso,
      label: d.toLocaleDateString('fr-CA', { weekday: 'short' }).replace('.', ''),
      day: d.getDate(),
      isToday: i === 0,
      count: countByDate.get(iso) ?? 0,
    }
  })

  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Mes tâches du jour</h2>
          <span className="text-xs text-gray-400 ml-auto">{myTasks.length} en attente</span>
        </div>
        <TasksTodayList initialTasks={myTasks as any} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ClientGallery title="Mes clients" clients={clientCards} />
        </div>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-auchu-500" />
            <h2 className="font-semibold text-gray-900">Prochaines deadlines</h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map(d => (
                <div key={d.iso} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-medium text-gray-400 uppercase">{d.label}</span>
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold',
                    d.isToday ? 'bg-auchu-500 text-white' : 'text-gray-700'
                  )}>
                    {d.day}
                  </div>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    d.count > 0 ? 'bg-auchu-400' : 'bg-transparent'
                  )} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
