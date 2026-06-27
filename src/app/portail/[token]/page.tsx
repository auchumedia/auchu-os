import { createAnonClient } from '@/lib/supabase/anon'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate, getInitials, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CheckCircle, Clock, FileText, Calendar, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const INVOICE_STATUS_CONFIG = {
  draft:     { label: 'Brouillon', cls: 'bg-gray-100   text-gray-600'  },
  envoye:    { label: 'Envoyé',    cls: 'bg-blue-100   text-blue-700'  },
  paye:      { label: 'Payé',      cls: 'bg-green-100  text-green-700' },
  en_retard: { label: 'En retard', cls: 'bg-red-100    text-red-700'   },
  annule:    { label: 'Annulé',    cls: 'bg-gray-100   text-gray-600'  },
}

const CONTENT_PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  linkedin: 'LinkedIn', google: 'Google Ads', meta: 'Meta Ads',
}

const CONTENT_STATUS_LABELS: Record<string, string> = {
  draft:    'Brouillon',
  review:   'À approuver',
  approuve: 'Approuvé',
  publie:   'Publié',
  refuse:   'Refusé',
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100   text-pink-700',
  facebook:  'bg-blue-100   text-blue-700',
  tiktok:    'bg-slate-100  text-slate-700',
  linkedin:  'bg-sky-100    text-sky-700',
  google:    'bg-amber-100  text-amber-700',
  meta:      'bg-indigo-100 text-indigo-700',
}

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]
const DAYS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

export default async function PortailPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams?: { m?: string }
}) {
  const supabase = createAnonClient()

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('portal_token', params.token)
    .eq('portal_enabled', true)
    .single()

  if (!client) notFound()

  // ─── Month for calendar (query param ?m=YYYY-MM) ─────────────────────────
  const now     = new Date()
  const mParam  = searchParams?.m
  let   calYear  = now.getFullYear()
  let   calMonth = now.getMonth() // 0-indexed

  if (mParam && /^\d{4}-\d{2}$/.test(mParam)) {
    const [y, mo] = mParam.split('-').map(Number)
    calYear  = y
    calMonth = mo - 1
  }

  const monthStart = new Date(calYear, calMonth, 1).toISOString()
  const monthEnd   = new Date(calYear, calMonth + 1, 0, 23, 59, 59).toISOString()

  const prevMonth = new Date(calYear, calMonth - 1, 1)
  const nextMonth = new Date(calYear, calMonth + 1, 1)
  const prevParam = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`
  const nextParam = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`

  // ─── Data fetching ────────────────────────────────────────────────────────
  const [
    { data: projects },
    { data: invoices },
    { data: toReview },
    { data: monthContent },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, status, priority, deadline')
      .eq('client_id', client.id)
      .neq('status', 'annule')
      .order('created_at', { ascending: false }),

    supabase
      .from('invoices')
      .select('id, invoice_number, status, subtotal, total, due_date, paid_at, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('content_pieces')
      .select('id, title, type, platform, status, scheduled_at, notes')
      .eq('client_id', client.id)
      .eq('status', 'review')
      .order('scheduled_at', { ascending: true }),

    supabase
      .from('content_pieces')
      .select('id, title, type, platform, status, scheduled_at')
      .eq('client_id', client.id)
      .gte('scheduled_at', monthStart)
      .lte('scheduled_at', monthEnd)
      .order('scheduled_at', { ascending: true }),
  ])

  // ─── Derived ──────────────────────────────────────────────────────────────
  const activeProjects    = (projects ?? []).filter(p => p.status !== 'termine')
  const completedProjects = (projects ?? []).filter(p => p.status === 'termine')
  const pendingAmount     = (invoices ?? [])
    .filter(i => i.status === 'envoye' || i.status === 'en_retard')
    .reduce((s, i) => s + i.total, 0)
  const reviewItems       = toReview ?? []
  const calItems          = monthContent ?? []

  // Build calendar grid
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const byDay: Record<number, typeof calItems> = {}
  calItems.forEach(c => {
    if (!c.scheduled_at) return
    const day = new Date(c.scheduled_at).getDate()
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(c)
  })

  const todayDay   = now.getDate()
  const isThisMonth = now.getFullYear() === calYear && now.getMonth() === calMonth

  const primary   = client.brand_primary   || '#6366f1'
  const secondary = client.brand_secondary || '#f95640'
  const gradient  = `linear-gradient(135deg, ${primary}, ${secondary})`

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ─── Hero header ───────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: gradient }}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg">
              {client.logo_url ? (
                <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-2xl">{getInitials(client.name)}</span>
              )}
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium tracking-wide uppercase">Portail client</p>
              <h1 className="text-3xl font-bold text-white mt-0.5">{client.name}</h1>
              {client.company && <p className="text-white/80 mt-1">{client.company}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Projets actifs</p>
              <p className="text-2xl font-bold text-white mt-1">{activeProjects.length}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Contenus à approuver</p>
              <p className="text-2xl font-bold text-white mt-1">{reviewItems.length}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide">En attente de paiement</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Body ──────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* ── Contenus à approuver ──────────────────────────────────────────── */}
        {reviewItems.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: gradient }}>
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-semibold text-gray-900">
                Contenus à approuver
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  {reviewItems.length}
                </span>
              </h2>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Ces contenus nécessitent votre approbation avant publication. Contactez votre gestionnaire de compte pour valider ou demander des modifications.
              </p>
            </div>

            <div className="space-y-2">
              {reviewItems.map(c => (
                <div key={c.id} className="bg-white rounded-xl border border-amber-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', PLATFORM_COLORS[c.platform] ?? 'bg-gray-100 text-gray-600')}>
                          {CONTENT_PLATFORM_LABELS[c.platform] ?? c.platform}
                        </span>
                        {c.type && (
                          <span className="text-xs text-gray-400">{c.type}</span>
                        )}
                        {c.scheduled_at && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Prévu le {formatDate(c.scheduled_at)}
                          </span>
                        )}
                      </div>
                      {c.notes && (
                        <p className="text-xs text-gray-500 mt-1.5 italic">{c.notes}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                      À approuver
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {client.email !== null && (
              <a
                href={`mailto:${client.email ?? ''}?subject=Approbation de contenus — ${client.name}&body=Bonjour,%0A%0AJ'ai pris connaissance des ${reviewItems.length} contenu(s) en attente d'approbation.%0A%0A`}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: gradient }}
              >
                Contacter mon gestionnaire de compte
              </a>
            )}
          </section>
        )}

        {/* ── Calendrier éditorial ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: gradient }}>
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-semibold text-gray-900">
                Calendrier éditorial — {MONTHS_FR[calMonth]} {calYear}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/portail/${params.token}?m=${prevParam}`}
                className="px-3 py-1.5 text-sm border border-gray-200 bg-white rounded-lg text-gray-600 hover:border-gray-300 transition-colors"
              >
                ←
              </Link>
              <Link
                href={`/portail/${params.token}`}
                className="px-3 py-1.5 text-sm border border-gray-200 bg-white rounded-lg text-gray-600 hover:border-gray-300 transition-colors"
              >
                Aujourd'hui
              </Link>
              <Link
                href={`/portail/${params.token}?m=${nextParam}`}
                className="px-3 py-1.5 text-sm border border-gray-200 bg-white rounded-lg text-gray-600 hover:border-gray-300 transition-colors"
              >
                →
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAYS_FR.map(d => (
                <div key={d} className="py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
              {cells.map((day, i) => {
                if (!day) return <div key={i} className="min-h-[90px] bg-gray-50/40" />
                const items   = byDay[day] ?? []
                const isToday = isThisMonth && day === todayDay
                return (
                  <div key={i} className={cn('min-h-[90px] p-1.5', isToday && 'bg-indigo-50/40')}>
                    <span className={cn(
                      'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                      isToday ? 'text-white' : 'text-gray-500'
                    )}
                    style={isToday ? { background: primary } : undefined}
                    >
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {items.slice(0, 3).map(item => (
                        <div
                          key={item.id}
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded font-medium truncate',
                            PLATFORM_COLORS[item.platform] ?? 'bg-gray-100 text-gray-600',
                            item.status === 'review' && 'ring-1 ring-amber-400'
                          )}
                          title={`${item.title}${item.status === 'review' ? ' (à approuver)' : ''}`}
                        >
                          {item.title}
                        </div>
                      ))}
                      {items.length > 3 && (
                        <p className="text-[10px] text-gray-400 pl-1">+{items.length - 3}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {calItems.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-4">Aucun contenu planifié ce mois-ci.</p>
          )}

          {/* Legend */}
          {calItems.length > 0 && (
            <div className="flex items-center gap-4 mt-3 pl-1">
              <p className="text-xs text-gray-400 font-medium">Légende :</p>
              {(['instagram','facebook','tiktok','linkedin'] as const).filter(p =>
                calItems.some(c => c.platform === p)
              ).map(p => (
                <span key={p} className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', PLATFORM_COLORS[p])}>
                  {CONTENT_PLATFORM_LABELS[p]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-300">
                À approuver
              </span>
            </div>
          )}
        </section>

        {/* ── Projets en cours ─────────────────────────────────────────────── */}
        {activeProjects.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: gradient }}>
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-semibold text-gray-900">Projets en cours</h2>
            </div>
            <div className="space-y-2">
              {activeProjects.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{p.title}</p>
                    {p.deadline && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Échéance : {formatDate(p.deadline)}
                      </p>
                    )}
                  </div>
                  <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', PROJECT_STATUS_COLORS[p.status])}>
                    {PROJECT_STATUS_LABELS[p.status]}
                  </span>
                </div>
              ))}
            </div>
            {completedProjects.length > 0 && (
              <p className="text-xs text-gray-400 mt-2 pl-1">
                + {completedProjects.length} projet{completedProjects.length > 1 ? 's' : ''} terminé{completedProjects.length > 1 ? 's' : ''}
              </p>
            )}
          </section>
        )}

        {/* ── Factures ─────────────────────────────────────────────────────── */}
        {(invoices ?? []).length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: gradient }}>
                <FileText className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-semibold text-gray-900">Factures</h2>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">N°</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Date</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Montant TTC</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Statut</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Échéance</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoices ?? []).map(inv => {
                    const cfg = INVOICE_STATUS_CONFIG[inv.status as keyof typeof INVOICE_STATUS_CONFIG]
                    return (
                      <tr key={inv.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 font-medium text-gray-900">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(inv.created_at)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">{formatCurrency(inv.total)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', cfg?.cls)}>
                            {cfg?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {inv.due_date ? formatDate(inv.due_date) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Empty state */}
        {activeProjects.length === 0 && reviewItems.length === 0 && (invoices ?? []).length === 0 && calItems.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: gradient }}>
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <p className="text-gray-500">Aucun contenu disponible pour l'instant.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 mt-8 py-6 text-center">
        <p className="text-xs text-gray-400">Portail propulsé par AuchuOS</p>
      </div>
    </div>
  )
}
