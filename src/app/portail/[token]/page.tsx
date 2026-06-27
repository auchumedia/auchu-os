import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatCurrency, formatDate, getInitials, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CheckCircle, Clock, FileText, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  draft:     { label: 'Brouillon',  cls: 'bg-gray-100   text-gray-600'  },
  envoye:    { label: 'Envoyé',     cls: 'bg-blue-100   text-blue-700'  },
  paye:      { label: 'Payé',       cls: 'bg-green-100  text-green-700' },
  en_retard: { label: 'En retard',  cls: 'bg-red-100    text-red-700'   },
  annule:    { label: 'Annulé',     cls: 'bg-gray-100   text-gray-600'  },
}

const CONTENT_PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  linkedin: 'LinkedIn', google: 'Google Ads', meta: 'Meta Ads',
}

export default async function PortailPage({ params }: { params: { token: string } }) {
  const supabase = await createClient()

  // This uses the anon key — the portal RLS policy allows reading
  // portal-enabled clients (see migration 003)
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
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, status, priority, deadline, tags')
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
      .select('id, title, type, platform, status, scheduled_at')
      .eq('client_id', client.id)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(8),
  ])

  const activeProjects   = (projects ?? []).filter(p => p.status !== 'termine')
  const completedProjects = (projects ?? []).filter(p => p.status === 'termine')
  const paidRevenue      = (invoices ?? []).filter(i => i.status === 'paye').reduce((s, i) => s + i.total, 0)
  const pendingAmount    = (invoices ?? []).filter(i => i.status === 'envoye' || i.status === 'en_retard').reduce((s, i) => s + i.total, 0)

  const primary   = client.brand_primary   || '#6366f1'
  const secondary = client.brand_secondary || '#f95640'
  const gradient  = `linear-gradient(135deg, ${primary}, ${secondary})`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── Hero header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: gradient }}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-4xl mx-auto px-6 py-12">
          <div className="flex items-center gap-5">
            {/* Logo */}
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

          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Projets actifs</p>
              <p className="text-2xl font-bold text-white mt-1">{activeProjects.length}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Montant encaissé</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(paidRevenue)}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide">En attente de paiement</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content ─────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Projects */}
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
                  <span className={cn('badge text-xs', PROJECT_STATUS_COLORS[p.status])}>
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

        {/* Upcoming content */}
        {(content ?? []).length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: gradient }}>
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-semibold text-gray-900">Contenu à venir</h2>
            </div>
            <div className="space-y-2">
              {(content ?? []).map(c => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{c.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {CONTENT_PLATFORM_LABELS[c.platform] ?? c.platform}
                      {c.scheduled_at && ` · ${formatDate(c.scheduled_at)}`}
                    </p>
                  </div>
                  <span className={cn('badge text-xs', ({
                    draft:    'badge-gray',
                    review:   'badge-amber',
                    approuve: 'badge-blue',
                    publie:   'badge-green',
                    refuse:   'badge-red',
                  } as Record<string, string>)[c.status] ?? 'badge-gray')}>
                    {c.status === 'approuve' ? 'Approuvé' : c.status === 'publie' ? 'Publié' : c.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Invoices */}
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
                    const cfg = STATUS_CONFIG[inv.status as keyof typeof STATUS_CONFIG]
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
        {activeProjects.length === 0 && (invoices ?? []).length === 0 && (content ?? []).length === 0 && (
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
