import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatRelative } from '@/lib/utils'
import { Users, FolderKanban, FileText, Receipt, Sparkles, Brain, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Tableau de bord' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'là'

  // Fetch stats in parallel
  const [clientsRes, projetsRes, contenuRes] = await Promise.all([
    supabase.from('clients').select('id, status', { count: 'exact' }).eq('user_id', user!.id),
    supabase.from('projects').select('id, status', { count: 'exact' }).eq('user_id', user!.id),
    supabase.from('content_pieces').select('id', { count: 'exact' }).eq('user_id', user!.id),
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
      label: 'Projets en cours',
      value: projetsRes.data?.filter((p) => p.status === 'en_cours').length ?? 0,
      icon: FolderKanban,
      color: 'text-amber-600 bg-amber-50',
      href: '/dashboard/projets',
    },
    {
      label: 'Contenus créés',
      value: contenuRes.count ?? 0,
      icon: FileText,
      color: 'text-purple-600 bg-purple-50',
      href: '/dashboard/contenu',
    },
  ]

  // Recent projects
  const { data: recentProjects } = await supabase
    .from('projects')
    .select('id, title, status, priority, deadline, clients(name)')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false })
    .limit(5)

  const now = new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
  const dateStr = new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 capitalize">{dateStr} · {now}</p>
          <h1 className="text-2xl font-semibold text-gray-900 mt-0.5">Bonjour, {firstName} 👋</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/agents/contenu" className="btn-secondary text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Agent contenu
          </Link>
          <Link href="/agents/productivite" className="btn-primary text-xs">
            <Brain className="w-3.5 h-3.5" />
            Planifier ma journée
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href} className="card hover:border-gray-200 transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                  <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>
              <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Projets récents */}
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Projets récents</h2>
            <Link href="/dashboard/projets" className="text-xs text-auchu-600 hover:underline">
              Voir tout
            </Link>
          </div>

          {!recentProjects || recentProjects.length === 0 ? (
            <div className="text-center py-8">
              <FolderKanban className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucun projet pour l'instant</p>
              <Link href="/dashboard/projets" className="text-xs text-auchu-600 hover:underline mt-1 inline-block">
                Créer un projet →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((project: any) => (
                <div key={project.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{project.title}</p>
                    <p className="text-xs text-gray-400">{project.clients?.name}</p>
                  </div>
                  <span className={`badge text-xs ${
                    project.status === 'en_cours' ? 'badge-blue' :
                    project.status === 'review' ? 'badge-amber' :
                    project.status === 'termine' ? 'badge-green' : 'badge-gray'
                  }`}>
                    {project.status === 'en_cours' ? 'En cours' :
                     project.status === 'review' ? 'Révision' :
                     project.status === 'termine' ? 'Terminé' : project.status}
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
            { href: '/dashboard/clients', label: 'Ajouter un client', icon: Users },
            { href: '/dashboard/projets', label: 'Nouveau projet', icon: FolderKanban },
            { href: '/agents/contenu', label: 'Générer du contenu IA', icon: Sparkles },
            { href: '/dashboard/finance', label: 'Créer une facture', icon: Receipt },
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
