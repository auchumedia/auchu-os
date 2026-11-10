import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import Link              from 'next/link'
import {
  ListChecks, AlertTriangle,
  CalendarDays, Clock, Film, Send, Video, Target,
} from 'lucide-react'
import ClientGallery, { type ClientCard } from '@/components/dashboard/ClientGallery'
import TasksTodayList from './TasksTodayList'
import FinanceSection from './FinanceSection'
import { cn, formatDate, getInitials, avatarColorFromName, deliverablesTarget, monthBounds, PRIORITY_LABELS } from '@/lib/utils'
import type { TaskPriority } from '@/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tableau de bord' }

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type OrgCtx = NonNullable<Awaited<ReturnType<typeof getOrgContext>>>

const TASK_PRIORITY_ORDER: Record<string, number> = { urgente: 0, haute: 1, normale: 2, basse: 3 }
const PRIORITY_DOT: Record<TaskPriority, string> = {
  basse: 'bg-gray-300', normale: 'bg-blue-400', haute: 'bg-amber-400', urgente: 'bg-red-500',
}

// clientIds === null : pas de filtrage (owner/director, tous les clients de
// l'org). clientIds === [...] : scopé à une équipe (stratege/monteur, via
// team_clients).
async function fetchClientCards(supabase: SupabaseClient, ownerId: string, clientIds: string[] | null): Promise<ClientCard[]> {
  let query = supabase.from('clients').select('id, name, logo_url, status').eq('user_id', ownerId).eq('status', 'actif').order('name')
  if (clientIds) query = query.in('id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: clients } = await query
  const ids = (clients ?? []).map(c => c.id)

  const reviewCounts: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: reviewRows } = await supabase
      .from('content_pieces')
      .select('client_id')
      .eq('user_id', ownerId)
      .eq('status', 'pret')
      .in('client_id', ids)
    for (const r of reviewRows ?? []) {
      if (r.client_id) reviewCounts[r.client_id] = (reviewCounts[r.client_id] ?? 0) + 1
    }
  }

  return (clients ?? []).map(c => ({ ...c, pendingReview: reviewCounts[c.id] ?? 0 }))
}

// Avatars de l'équipe affichés dans le bandeau — membres actifs de l'org
// (propriétaire inclus), lecture seule, même source que la page Équipe.
async function fetchTeamAvatars(supabase: SupabaseClient, ctx: OrgCtx) {
  if (!ctx.org) return []
  const { data: orgMembersRaw } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', ctx.org.id)
    .eq('status', 'actif')

  const ids = Array.from(new Set([ctx.org.owner_id, ...(orgMembersRaw ?? []).map(m => m.user_id)]))
  if (ids.length === 0) return []

  const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', ids)
  return (profiles ?? []).map(p => ({ id: p.id, name: p.full_name || p.email || 'Membre', avatar_url: p.avatar_url as string | null }))
}

// Tournages / publications à venir — alimente à la fois la bande "semaine"
// et la liste "prochains contenus". clientIds === null : org entière.
async function fetchUpcomingEvents(supabase: SupabaseClient, ownerId: string, clientIds: string[] | null, todayISO: string) {
  let query = supabase
    .from('calendar_events')
    .select('id, type, title, date, client:clients(name)')
    .eq('user_id', ownerId)
    .in('type', ['tournage', 'publication'])
    .gte('date', todayISO)
    .order('date', { ascending: true })
    .limit(40)
  if (clientIds) query = query.in('client_id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])

  const { data } = await query
  return (data ?? []) as { id: string; type: string; title: string; date: string; client: { name: string } | { name: string }[] | null }[]
}

// Progression des livrables du mois, par contact actif — X = contenus
// filmés/publiés dont month_target tombe ce mois-ci, Y = objectif
// (deliverables_short_form + deliverables_long_form). clientIds === null :
// org entière (owner/director) ; sinon scopé à l'équipe (même convention que
// fetchClientCards/fetchUpcomingEvents).
async function fetchDeliverablesProgress(supabase: SupabaseClient, ownerId: string, clientIds: string[] | null, now: Date) {
  let query = supabase
    .from('clients')
    .select('id, name, logo_url, deliverables_short_form, deliverables_long_form')
    .eq('user_id', ownerId)
    .eq('status', 'actif')
    .order('name')
  if (clientIds) query = query.in('id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: clients } = await query
  const activeClients = (clients ?? []).filter(c => deliverablesTarget(c) > 0)
  if (activeClients.length === 0) return []

  const { startISO, endISO } = monthBounds(now)
  const ids = activeClients.map(c => c.id)
  const { data: pieces } = await supabase
    .from('content_pieces')
    .select('client_id')
    .eq('user_id', ownerId)
    .in('client_id', ids)
    .in('status', ['filme', 'publie'])
    .gte('month_target', startISO)
    .lt('month_target', endISO)

  const delivered = new Map<string, number>()
  for (const p of pieces ?? []) {
    if (p.client_id) delivered.set(p.client_id, (delivered.get(p.client_id) ?? 0) + 1)
  }

  const dayOfMonth   = now.getDate()
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const paceExpected = dayOfMonth / daysInMonth

  return activeClients.map(c => {
    const target = deliverablesTarget(c)
    const done   = delivered.get(c.id) ?? 0
    const complete = done >= target
    const expected  = Math.ceil(target * paceExpected)
    const behind    = !complete && done < expected
    return {
      id: c.id, name: c.name, logo_url: c.logo_url,
      target, delivered: done, remaining: Math.max(0, target - done),
      status: complete ? 'complete' as const : behind ? 'behind' as const : 'ontrack' as const,
    }
  })
}

function buildWeekDays(now: Date, events: { date: string }[]) {
  const countByDate = new Map<string, number>()
  for (const e of events) countByDate.set(e.date, (countByDate.get(e.date) ?? 0) + 1)
  return Array.from({ length: 7 }, (_, i) => {
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

  const teamAvatars = await fetchTeamAvatars(supabase, ctx)

  return (
    <div className="-mx-4 md:-mx-6 -mt-6 md:-mt-8 -mb-24 md:-mb-8 px-4 md:px-6 pt-6 md:pt-8 pb-24 md:pb-8">
      <div className="space-y-6 md:space-y-8">
        {/* Bandeau */}
        <div className="bg-ink rounded-3xl px-6 md:px-8 py-6 md:py-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display uppercase text-white text-2xl md:text-3xl leading-tight">
              Bonjour <span className="text-auchu-400">{firstName}</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1 capitalize">{dateStr}</p>
          </div>
          {teamAvatars.length > 0 && (
            <div className="flex items-center -space-x-2.5">
              {teamAvatars.slice(0, 6).map(m => (
                <div
                  key={m.id}
                  title={m.name}
                  className="w-9 h-9 rounded-full ring-2 ring-ink bg-white/10 flex items-center justify-center text-xs font-semibold text-white overflow-hidden flex-shrink-0"
                >
                  {m.avatar_url
                    ? <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" />
                    : getInitials(m.name)}
                </div>
              ))}
              {teamAvatars.length > 6 && (
                <div className="w-9 h-9 rounded-full ring-2 ring-ink bg-white/10 flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0">
                  +{teamAvatars.length - 6}
                </div>
              )}
            </div>
          )}
        </div>

        {isOrgView
          ? await OrgDashboard(supabase, ctx, ownerId, now, todayISO)
          : await TeamDashboard(supabase, ctx, ownerId, userId, now, todayISO)}
      </div>
    </div>
  )
}

// ─── Colonne droite partagée : calendrier de la semaine + prochains tournages/publications ──
function UpcomingColumn({ now, events }: { now: Date; events: Awaited<ReturnType<typeof fetchUpcomingEvents>> }) {
  const weekDays = buildWeekDays(now, events)
  const upcoming = events.slice(0, 6)

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4 text-auchu-500" />
        <h2 className="font-semibold text-gray-900">Cette semaine</h2>
      </div>

      <div className="card p-4">
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
              <span className={cn('w-1.5 h-1.5 rounded-full', d.count > 0 ? 'bg-auchu-400' : 'bg-transparent')} />
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-6 mb-3">À tourner / publier</p>
      {upcoming.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-sm text-gray-400">Rien de prévu pour l'instant.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border-soft shadow-sm divide-y divide-gray-50">
          {upcoming.map(e => {
            const clientName = Array.isArray(e.client) ? e.client[0]?.name : e.client?.name
            const isShoot = e.type === 'tournage'
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', isShoot ? 'bg-auchu-50 text-auchu-600' : 'bg-purple-50 text-purple-600')}>
                  {isShoot ? <Video className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                  <p className="text-xs text-gray-400 truncate">{clientName ?? 'Sans client'}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(e.date)}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── Carte "Livrables du mois" — une ligne par contact actif, partagée entre
//     les deux vues (données scopées par rôle via fetchDeliverablesProgress) ──
function DeliverablesCard({ rows }: { rows: Awaited<ReturnType<typeof fetchDeliverablesProgress>> }) {
  if (rows.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-auchu-500" />
        <h2 className="font-semibold text-gray-900">Livrables du mois</h2>
      </div>
      <div className="bg-white rounded-2xl border border-border-soft shadow-sm divide-y divide-gray-50">
        {rows.map(r => {
          const pct = r.target > 0 ? Math.min(100, Math.round((r.delivered / r.target) * 100)) : 0
          const barColor =
            r.status === 'complete' ? 'bg-green-500' :
            r.status === 'behind'   ? 'bg-amber-500' : 'bg-auchu-500'
          const textColor =
            r.status === 'complete' ? 'text-green-600' :
            r.status === 'behind'   ? 'text-amber-600' : 'text-gray-500'
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3.5">
              {r.logo_url ? (
                <img src={r.logo_url} alt={r.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0', avatarColorFromName(r.name))}>
                  {getInitials(r.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                  <span className="text-xs text-gray-400 flex-shrink-0">{r.delivered} / {r.target}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className={cn('text-xs font-medium flex-shrink-0 w-24 text-right', textColor)}>
                {r.status === 'complete' ? 'Complété' : `Reste ${r.remaining} à produire`}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Vue owner / director ────────────────────────────────────────────────────

async function OrgDashboard(
  supabase: SupabaseClient,
  ctx: OrgCtx,
  ownerId: string,
  now: Date,
  todayISO: string,
) {
  const monthStartISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEndISO   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekStartISO = weekStart.toISOString().split('T')[0]

  const [
    clientsRes, activeTasksCountRes,
    clientCards, urgentTasksRes,
    filmedCountRes, publishedCountRes,
    orgTasksForHoursRes, upcomingEvents,
    deliverables,
  ] = await Promise.all([
    supabase.from('clients').select('id, status').eq('user_id', ownerId),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'en_cours'),
    fetchClientCards(supabase, ownerId, null),
    supabase.from('tasks')
      .select('id, title, priority, deadline, assigned_to, client:clients(name)')
      .eq('user_id', ownerId)
      .not('status', 'in', '(termine,approuve)')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(30),
    supabase.from('content_pieces').select('id', { count: 'exact', head: true })
      .eq('user_id', ownerId).eq('status', 'filme')
      .gte('updated_at', monthStartISO).lt('updated_at', monthEndISO),
    supabase.from('content_pieces').select('id', { count: 'exact', head: true })
      .eq('user_id', ownerId).eq('status', 'publie')
      .gte('published_at', monthStartISO).lt('published_at', monthEndISO),
    supabase.from('tasks').select('id').eq('user_id', ownerId),
    fetchUpcomingEvents(supabase, ownerId, null, todayISO),
    fetchDeliverablesProgress(supabase, ownerId, null, now),
  ])

  const clientsActifs = (clientsRes.data ?? []).filter(c => c.status === 'actif').length

  // ── Heures travaillées cette semaine (toute l'équipe) ──────────────────────
  const orgTaskIds = (orgTasksForHoursRes.data ?? []).map(t => t.id)
  let hoursThisWeek = 0
  if (orgTaskIds.length > 0) {
    const { data: weekEntries } = await supabase
      .from('time_entries')
      .select('duration_seconds')
      .in('task_id', orgTaskIds)
      .not('duration_seconds', 'is', null)
      .gte('started_at', weekStartISO)
    hoursThisWeek = (weekEntries ?? []).reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0) / 3600
  }

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
    { label: 'Filmés ce mois',      value: filmedCountRes.count ?? 0, icon: Film,       color: 'text-auchu-600 bg-auchu-50' },
    { label: 'Publiés ce mois',     value: publishedCountRes.count ?? 0, icon: Send,    color: 'text-purple-600 bg-purple-50' },
    { label: 'Tâches en cours',     value: activeTasksCountRes.count ?? 0, icon: ListChecks, color: 'text-gray-700 bg-gray-100' },
    { label: 'Heures cette semaine', value: hoursThisWeek.toFixed(1).replace('.0', ''), icon: Clock, color: 'text-amber-600 bg-amber-50' },
  ]

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="card p-5">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', s.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Galerie clients */}
      <ClientGallery title="Contacts actifs" clients={clientCards} />

      <DeliverablesCard rows={deliverables} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mes tâches (urgentes, toute l'org) */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-auchu-500" />
            <h2 className="font-semibold text-gray-900">Mes tâches</h2>
            <Link href="/dashboard/taches" className="text-xs text-auchu-600 hover:underline ml-auto">Voir tout</Link>
          </div>
          {urgentTasks.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-sm text-gray-400">Aucune tâche urgente pour l'instant.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border-soft shadow-sm divide-y divide-gray-50">
              {urgentTasks.map((t: any) => {
                const isOverdue = !!t.deadline && new Date(t.deadline) < now
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3.5">
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

        <UpcomingColumn now={now} events={upcomingEvents} />
      </div>

      {/* Finances — owner/director uniquement. OrgDashboard() n'est appelé
          que pour ces deux rôles (cf. isOrgView dans DashboardPage), et
          FinanceSection re-vérifie elle-même via l'API (403 sinon) : la
          donnée financière n'est jamais récupérée ni rendue pour les autres
          rôles, ni côté serveur ni côté client. */}
      {(ctx.isOwner || ctx.isDirector) && <FinanceSection isOwner={ctx.isOwner} />}
    </>
  )
}

// ─── Vue stratège / monteur ───────────────────────────────────────────────────

async function TeamDashboard(
  supabase: SupabaseClient,
  ctx: OrgCtx,
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

  const [clientCards, myTasksRes, upcomingEvents, deliverables] = await Promise.all([
    fetchClientCards(supabase, ownerId, teamClientIds),
    supabase.from('tasks')
      .select('id, title, status, priority, deadline, client:clients(name)')
      .eq('user_id', ownerId)
      .eq('assigned_to', userId)
      .not('status', 'in', '(termine,approuve)')
      .order('deadline', { ascending: true, nullsFirst: false }),
    fetchUpcomingEvents(supabase, ownerId, teamClientIds, todayISO),
    fetchDeliverablesProgress(supabase, ownerId, teamClientIds, now),
  ])

  const myTasks = ((myTasksRes.data ?? []) as any[])
    .slice()
    .sort((a, b) => (TASK_PRIORITY_ORDER[a.priority] ?? 2) - (TASK_PRIORITY_ORDER[b.priority] ?? 2))

  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Mes tâches</h2>
          <span className="text-xs text-gray-400 ml-auto">{myTasks.length} en attente</span>
        </div>
        <TasksTodayList initialTasks={myTasks as any} />
      </section>

      <DeliverablesCard rows={deliverables} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ClientGallery title="Mes contacts" clients={clientCards} />
        </div>

        <UpcomingColumn now={now} events={upcomingEvents} />
      </div>
    </>
  )
}
