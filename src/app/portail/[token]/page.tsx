import { createAnonClient } from '@/lib/supabase/anon'
import { notFound } from 'next/navigation'
import { formatCurrency, formatDate, getInitials, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CheckCircle, Clock, FileText } from 'lucide-react'
import PortalContent from './PortalContent'

export const dynamic = 'force-dynamic'

const INVOICE_STATUS_CONFIG = {
  draft:     { label: 'Brouillon', cls: 'bg-gray-100   text-gray-600'  },
  envoye:    { label: 'Envoyé',    cls: 'bg-blue-100   text-blue-700'  },
  paye:      { label: 'Payé',      cls: 'bg-green-100  text-green-700' },
  en_retard: { label: 'En retard', cls: 'bg-red-100    text-red-700'   },
  annule:    { label: 'Annulé',    cls: 'bg-gray-100   text-gray-600'  },
}

export default async function PortailPage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = createAnonClient()

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('portal_token', params.token)
    .eq('portal_enabled', true)
    .single()

  if (!client) notFound()

  const [
    { data: projects },
    { data: invoices },
    { data: content },
    { data: events },
    { data: orgInfo },
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
      .select('*')
      .eq('client_id', client.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false }),

    supabase
      .from('calendar_events')
      .select('*')
      .eq('client_id', client.id)
      .order('date', { ascending: true }),

    supabase
      .from('organizations')
      .select('name, logo_url, primary_color, secondary_color, website, email')
      .eq('owner_id', client.user_id)
      .maybeSingle(),
  ])

  const activeProjects    = (projects ?? []).filter(p => p.status !== 'termine')
  const completedProjects = (projects ?? []).filter(p => p.status === 'termine')
  const toApprove         = (content ?? []).filter(c => c.status === 'pret')
  const pendingAmount     = (invoices ?? [])
    .filter(i => i.status === 'envoye' || i.status === 'en_retard')
    .reduce((s, i) => s + i.total, 0)

  // Contenu du mois — total des livrables définis dans la fiche client
  // (vidéos + stories + ads), pas un comptage par scheduled_at.
  const deliverablesTotal =
    (client.deliverables_video_organique ?? 0) +
    (client.deliverables_story ?? 0) +
    (client.deliverables_ad ?? 0)

  const primary   = client.brand_primary   || orgInfo?.primary_color   || '#6366f1'
  const secondary = client.brand_secondary || orgInfo?.secondary_color || '#f95640'
  const gradient  = `linear-gradient(135deg, ${primary}, ${secondary})`

  const orgInitials = (orgInfo?.name ?? 'A').split(/\s+/).map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ─── Hero header ───────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: gradient }}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg">
              {client.logo_url
                ? <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover" />
                : <span className="text-white font-bold text-2xl">{getInitials(client.name)}</span>}
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium tracking-wide uppercase">Portail client</p>
              <h1 className="text-3xl font-bold text-white mt-0.5">{client.name}</h1>
              {client.company && <p className="text-white/80 mt-1">{client.company}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Contenu du mois</p>
              <p className="text-2xl font-bold text-white mt-1">{deliverablesTotal}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Contenus à approuver</p>
              <p className="text-2xl font-bold text-white mt-1">{toApprove.length}</p>
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

        {/* Contenu interactif (client component) */}
        <PortalContent
          content={content ?? []}
          events={events ?? []}
          token={params.token}
          primary={primary}
          secondary={secondary}
        />

        {/* ── Projets en cours ───────────────────────────────────────────────── */}
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

        {/* ── Factures ───────────────────────────────────────────────────────── */}
        {(invoices ?? []).length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: gradient }}>
                <FileText className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-semibold text-gray-900">Factures</h2>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Mobile : cartes empilées */}
              <div className="sm:hidden divide-y divide-gray-50">
                {(invoices ?? []).map(inv => {
                  const cfg = INVOICE_STATUS_CONFIG[inv.status as keyof typeof INVOICE_STATUS_CONFIG]
                  return (
                    <div key={inv.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{inv.invoice_number}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(inv.created_at)}
                            {inv.due_date && ` · échéance ${formatDate(inv.due_date)}`}
                          </p>
                        </div>
                        <p className="font-semibold text-gray-900 tabular-nums flex-shrink-0">{formatCurrency(inv.total)}</p>
                      </div>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-2', cfg?.cls)}>
                        {cfg?.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Desktop : tableau */}
              <table className="w-full text-sm hidden sm:table">
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
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 mt-8 py-6">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Branding org */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ background: primary }}
            >
              {orgInfo?.logo_url
                ? <img src={orgInfo.logo_url} alt={orgInfo.name ?? ''} className="w-full h-full object-cover" />
                : <span className="text-white text-xs font-bold">{orgInitials}</span>
              }
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{orgInfo?.name ?? 'Votre agence'}</p>
              {orgInfo?.website && (
                <a href={orgInfo.website} target="_blank" rel="noopener noreferrer"
                   className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  {orgInfo.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400">Portail propulsé par AuchuOS</p>
        </div>
      </div>
    </div>
  )
}
