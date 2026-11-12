import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import Link              from 'next/link'
import {
  CheckCircle2, Video, AlertTriangle,
} from 'lucide-react'
import FinanceSection from './FinanceSection'
import { fetchClientDeliverableRows } from '@/lib/deliverablesServer'
import { monthKeyFromDate } from '@/lib/deliverables'
import { cn, formatDate, getInitials } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tableau de bord' }

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type OrgCtx = NonNullable<Awaited<ReturnType<typeof getOrgContext>>>

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

// clientIds === null : pas de filtrage (owner/director, toute l'org).
// clientIds === [...] : scopé à une équipe (stratege/monteur).
async function resolveClientIds(supabase: SupabaseClient, ctx: OrgCtx): Promise<string[] | null> {
  if (ctx.isOwner || ctx.isDirector) return null
  if (!ctx.teamId) return []
  const { data: tc } = await supabase.from('team_clients').select('client_id').eq('team_id', ctx.teamId)
  return (tc ?? []).map(c => c.client_id)
}

export default async function DashboardPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')

  const supabase = await createClient()
  const ownerId  = ctx.dataOwnerId
  const firstName = (ctx.userName || ctx.userEmail).split(' ')[0].split('@')[0]

  const now      = new Date()
  const dateStr  = now.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })

  const teamAvatars = await fetchTeamAvatars(supabase, ctx)

  return (
    <div className="-mx-4 md:-mx-6 -mt-6 md:-mt-8 -mb-24 md:-mb-8 px-4 md:px-6 pt-6 md:pt-8 pb-24 md:pb-8">
      <div className="space-y-8">
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

        <FinanceSection isOwner={ctx.isOwner} isDirector={ctx.isDirector}>
          <ToDoColumn supabase={supabase} ctx={ctx} ownerId={ownerId} now={now} />
        </FinanceSection>
      </div>
    </div>
  )
}

// ─── 3) "À faire maintenant" — rendue côté serveur, toujours au mois réel
//     (indépendante du sélecteur de mois de la bande de chiffres clés, qui
//     sert à consulter l'historique). Scopée par rôle comme le reste. ──────
async function ToDoColumn({
  supabase, ctx, ownerId, now,
}: {
  supabase: SupabaseClient
  ctx: OrgCtx
  ownerId: string
  now: Date
}) {
  const todayISO = now.toISOString().split('T')[0]
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndISO = weekEnd.toISOString().split('T')[0]

  const clientIds = await resolveClientIds(supabase, ctx)
  const scopedIn = (ids: string[]) => (ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])

  let pendingApprovalQuery = supabase
    .from('content_pieces')
    .select('id, title, client:clients(id, name)')
    .eq('user_id', ownerId)
    .eq('status', 'pret')
    .order('updated_at', { ascending: false })
    .limit(6)
  let readyToShootQuery = supabase
    .from('content_pieces')
    .select('id, title, scheduled_at, client:clients(id, name)')
    .eq('user_id', ownerId)
    .eq('status', 'approuve')
    .gte('scheduled_at', todayISO)
    .lte('scheduled_at', weekEndISO)
    .order('scheduled_at', { ascending: true })
    .limit(6)

  if (clientIds) {
    pendingApprovalQuery = pendingApprovalQuery.in('client_id', scopedIn(clientIds))
    readyToShootQuery = readyToShootQuery.in('client_id', scopedIn(clientIds))
  }

  const [pendingApprovalRes, readyToShootRes, deliverables] = await Promise.all([
    pendingApprovalQuery,
    readyToShootQuery,
    fetchClientDeliverableRows(supabase, ownerId, clientIds, monthKeyFromDate(now)),
  ])

  const lateClients = deliverables.rows.filter(r => r.totalLate > 0).slice(0, 6)

  const pendingApproval = (pendingApprovalRes.data ?? []) as any[]
  const readyToShoot = (readyToShootRes.data ?? []) as any[]

  const hasAnything = pendingApproval.length > 0 || readyToShoot.length > 0 || lateClients.length > 0

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-auchu-500" />
        <h2 className="font-semibold text-gray-900">À faire maintenant</h2>
      </div>

      {!hasAnything ? (
        <div className="card text-center py-10">
          <p className="text-sm text-gray-400">Rien à signaler pour l'instant — tout est à jour.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ToDoList
            icon={CheckCircle2}
            iconClass="bg-amber-50 text-amber-600"
            title="En attente d'approbation"
            emptyLabel="Rien en attente."
            items={pendingApproval.map(p => ({
              id: p.id,
              primary: p.title,
              secondary: p.client?.name ?? 'Sans contact',
              href: p.client?.id ? `/dashboard/clients/${p.client.id}` : undefined,
            }))}
          />
          <ToDoList
            icon={Video}
            iconClass="bg-auchu-50 text-auchu-600"
            title="Prêts à filmer cette semaine"
            emptyLabel="Rien de prévu cette semaine."
            items={readyToShoot.map(p => ({
              id: p.id,
              primary: p.title,
              secondary: p.client?.name ?? 'Sans contact',
              meta: p.scheduled_at ? formatDate(p.scheduled_at) : undefined,
              href: p.client?.id ? `/dashboard/clients/${p.client.id}` : undefined,
            }))}
          />
          <ToDoList
            icon={AlertTriangle}
            iconClass="bg-red-50 text-red-600"
            title="Clients en retard"
            emptyLabel="Aucun contact en retard."
            items={lateClients.map(c => ({
              id: c.id,
              primary: c.name,
              secondary: `${c.totalLate} livrable${c.totalLate !== 1 ? 's' : ''} en retard`,
              href: `/dashboard/clients/${c.id}`,
            }))}
          />
        </div>
      )}
    </section>
  )
}

function ToDoList({
  icon: Icon, iconClass, title, emptyLabel, items,
}: {
  icon: React.ElementType
  iconClass: string
  title: string
  emptyLabel: string
  items: { id: string; primary: string; secondary?: string; meta?: string; href?: string }[]
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', iconClass)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-xs font-semibold text-gray-700">{title}</p>
        <span className="text-xs text-gray-400 ml-auto">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 px-4 pb-4">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map(item => {
            const content = (
              <div className="px-4 py-2.5">
                <p className="text-sm text-gray-900 truncate">{item.primary}</p>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  {item.secondary && <p className="text-xs text-gray-400 truncate">{item.secondary}</p>}
                  {item.meta && <span className="text-xs text-gray-400 flex-shrink-0">{item.meta}</span>}
                </div>
              </div>
            )
            return item.href ? (
              <Link key={item.id} href={item.href} className="block hover:bg-gray-50/70 transition-colors">
                {content}
              </Link>
            ) : (
              <div key={item.id}>{content}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}
