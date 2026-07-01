import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { canCreateClients } from '@/lib/roles'
import { formatCurrency } from '@/lib/utils'
import { Plus, Users } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Clients' }

export default async function ClientsPage() {
  const supabase = await createClient()
  const ctx = await getOrgContext()

  // Le scoping par équipe est entièrement géré par les RLS ("clients: director
  // read" / "clients: team read" / "clients: owner all") — cette requête est
  // volontairement identique pour les 5 rôles, la DB filtre automatiquement.
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', ctx?.dataOwnerId ?? '')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[clients] Supabase error:', error.message, '| code:', error.code, '| user:', ctx?.userId)
  }

  const isTeamScoped   = !!ctx && !ctx.isOwner && ctx.role !== 'director'
  const notYetOnTeam   = isTeamScoped && !ctx?.teamId
  const canCreate      = canCreateClients(ctx?.role ?? '')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients?.length ?? 0} clients enregistrés</p>
        </div>
        {canCreate && (
          <Link href="/dashboard/clients/nouveau" className="btn-primary">
            <Plus className="w-4 h-4" />
            Nouveau client
          </Link>
        )}
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 text-red-700 text-sm p-4">
          <p className="font-semibold">Erreur Supabase</p>
          <p className="font-mono text-xs mt-1">{error.message} (code: {error.code})</p>
          <p className="text-xs mt-1 text-red-500">user_id: {ctx?.userId}</p>
        </div>
      )}

      {!error && (!clients || clients.length === 0) ? (
        <div className="card text-center py-16">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-700 mb-1">
            {notYetOnTeam ? 'Pas encore assigné à une équipe' : 'Aucun client'}
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            {notYetOnTeam
              ? 'Un owner ou director doit vous placer dans une équipe pour voir des clients.'
              : !canCreate
                ? 'Aucun client n\'est encore assigné à votre équipe.'
                : 'Ajoute ton premier client pour commencer'}
          </p>
          {canCreate && (
            <Link href="/dashboard/clients/nouveau" className="btn-primary inline-flex">
              <Plus className="w-4 h-4" />
              Ajouter un client
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Mobile : cartes empilées, chaque carte entièrement cliquable */}
          <div className="md:hidden space-y-2">
            {(clients ?? []).map((client: any) => (
              <Link
                key={client.id}
                href={`/dashboard/clients/${client.id}`}
                className="card block p-4 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{client.name}</p>
                    <p className="text-xs text-gray-400 truncate">{client.email}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${
                    client.status === 'actif' ? 'badge-green' :
                    client.status === 'prospect' ? 'badge-blue' : 'badge-gray'
                  }`}>
                    {client.status === 'actif' ? 'Actif' :
                     client.status === 'prospect' ? 'Prospect' : 'Inactif'}
                  </span>
                </div>
                {(client.platforms ?? []).length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {client.platforms.map((p: string) => (
                      <span key={p} className="badge badge-gray text-xs capitalize">{p}</span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-700 mt-2">
                  {client.monthly_budget ? formatCurrency(client.monthly_budget) : 'Aucun budget mensuel'}
                </p>
              </Link>
            ))}
          </div>

          {/* Desktop : tableau */}
          <div className="table-wrapper hidden md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Statut</th>
                  <th>Plateformes</th>
                  <th>Budget mensuel</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(clients ?? []).map((client: any) => (
                  <tr key={client.id}>
                    <td>
                      <div>
                        <p className="font-medium text-gray-900">{client.name}</p>
                        <p className="text-xs text-gray-400">{client.email}</p>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        client.status === 'actif' ? 'badge-green' :
                        client.status === 'prospect' ? 'badge-blue' : 'badge-gray'
                      }`}>
                        {client.status === 'actif' ? 'Actif' :
                         client.status === 'prospect' ? 'Prospect' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {(client.platforms || []).map((p: string) => (
                          <span key={p} className="badge badge-gray text-xs capitalize">{p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="text-gray-700">
                      {client.monthly_budget ? formatCurrency(client.monthly_budget) : '—'}
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="text-xs text-auchu-600 hover:underline"
                      >
                        Voir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
