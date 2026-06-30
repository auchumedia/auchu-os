import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { formatCurrency } from '@/lib/utils'
import { Users, FileText, Receipt, Brain, ArrowRight, CalendarDays } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tableau de bord' }

export default async function DashboardPage() {
  const ctx = await getOrgContext()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName  = ctx?.userName?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || 'là'
  const ownerId    = ctx?.dataOwnerId ?? user?.id ?? ''

  const [clientsRes, contenuRes, invoicesRes] = await Promise.all([
    supabase.from('clients').select('id, status', { count: 'exact' }).eq('user_id', ownerId),
    supabase.from('content_pieces').select('id', { count: 'exact' }).eq('user_id', ownerId),
    supabase.from('invoices').select('id, status').eq('user_id', ownerId),
  ])

  const stats = [
    {
      label: 'Clients actifs',
      value: clientsRes.data?.filter((c) => c.status === 'actif').length ?? 0,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
      href: '/dashboard/clients',
    },
    {
      label: 'Contenus créés',
      value: contenuRes.count ?? 0,
      icon: FileText,
      color: 'text-purple-600 bg-purple-50',
      href: '/dashboard/contenu',
    },
    {
      label: 'Factures en attente',
      value: invoicesRes.data?.filter(i => i.status === 'envoye' || i.status === 'en_retard').length ?? 0,
      icon: Receipt,
      color: 'text-amber-600 bg-amber-50',
      href: '/dashboard/finance',
    },
  ]

  const { data: recentContent } = await supabase
    .from('content_pieces')
    .select('id, title, status, platform, clients(name)')
    .eq('user_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(5)

  const now     = new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
  const dateStr = new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 capitalize">{dateStr} · {now}</p>
          <h1 className="text-2xl font-semibold text-gray-900 mt-0.5">Bonjour, {firstName} 👋</h1>
        </div>
        <Link href="/agents/productivite" className="btn-primary text-xs">
          <Brain className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Planifier ma journée</span>
          <span className="sm:hidden">Planifier</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href} className="card hover:border-gray-200 transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>
              <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contenus récents */}
        <div className="md:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Contenus récents</h2>
            <Link href="/dashboard/contenu" className="text-xs text-auchu-600 hover:underline">
              Voir tout
            </Link>
          </div>

          {!recentContent || recentContent.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucun contenu pour l'instant</p>
              <Link href="/dashboard/contenu" className="text-xs text-auchu-600 hover:underline mt-1 inline-block">
                Créer du contenu →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentContent.map((piece: any) => (
                <div key={piece.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{piece.title}</p>
                    <p className="text-xs text-gray-400">{piece.clients?.name}</p>
                  </div>
                  <span className={`badge text-xs ${
                    piece.status === 'publie'       ? 'badge-green' :
                    piece.status === 'approuve'     ? 'badge-green' :
                    piece.status === 'review'       ? 'badge-amber' :
                    piece.status === 'pret'         ? 'badge-blue'  : 'badge-gray'
                  }`}>
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
        </div>

        {/* Actions rapides */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Actions rapides</h2>
          {[
            { href: '/dashboard/clients',    label: 'Ajouter un client',    icon: Users        },
            { href: '/dashboard/contenu',    label: 'Créer du contenu',     icon: FileText     },
            { href: '/dashboard/calendrier', label: 'Voir le calendrier',   icon: CalendarDays },
            { href: '/dashboard/finance',    label: 'Créer une facture',    icon: Receipt      },
          ].map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50 transition-colors group"
              >
                <Icon className="w-4 h-4 text-gray-400 group-hover:text-auchu-600 transition-colors" />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{action.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 ml-auto group-hover:text-gray-500 transition-colors" />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
