import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Plus, Users } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Clients' }

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients?.length ?? 0} clients enregistrés</p>
        </div>
        <Link href="/dashboard/clients/nouveau" className="btn-primary">
          <Plus className="w-4 h-4" />
          Nouveau client
        </Link>
      </div>

      {!clients || clients.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-700 mb-1">Aucun client encore</h3>
          <p className="text-xs text-gray-400 mb-4">Ajoute ton premier client pour commencer</p>
          <Link href="/dashboard/clients/nouveau" className="btn-primary inline-flex">
            <Plus className="w-4 h-4" />
            Ajouter un client
          </Link>
        </div>
      ) : (
        <div className="table-wrapper">
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
              {clients.map((client: any) => (
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
      )}
    </div>
  )
}
