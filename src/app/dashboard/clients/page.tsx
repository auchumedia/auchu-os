import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { canCreateClients } from '@/lib/roles'
import { deliverablesTarget, monthBounds } from '@/lib/utils'
import { Plus, Users } from 'lucide-react'
import Link from 'next/link'
import ContactsTable, { type ContactRow } from './ContactsTable'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Contacts' }

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

  const isTeamScoped = !!ctx && !ctx.isOwner && ctx.role !== 'director'
  const notYetOnTeam = isTeamScoped && !ctx?.teamId
  const canCreate     = canCreateClients(ctx?.role ?? '')

  const clientIds = (clients ?? []).map(c => c.id)
  const now = new Date()
  const { startISO, endISO } = monthBounds(now)

  // ── Contenus du mois (X) + dernier contenu par contact ─────────────────────
  // month_target = mois ciblé par le livrable, indépendant de quand la ligne a
  // été modifiée — c'est le champ utilisé partout ailleurs (ProjetsTab,
  // portail) pour "le contenu du mois".
  const deliveredThisMonth = new Map<string, number>()
  const lastContentByClient = new Map<string, { title: string; date: string }>()

  if (clientIds.length > 0) {
    const { data: pieces } = await supabase
      .from('content_pieces')
      .select('client_id, title, status, month_target, updated_at')
      .eq('user_id', ctx?.dataOwnerId ?? '')
      .in('client_id', clientIds)
      .order('updated_at', { ascending: false })

    for (const p of pieces ?? []) {
      if (!p.client_id) continue
      if (!lastContentByClient.has(p.client_id)) {
        lastContentByClient.set(p.client_id, { title: p.title, date: p.updated_at })
      }
      if (
        (p.status === 'filme' || p.status === 'publie') &&
        p.month_target && p.month_target >= startISO && p.month_target < endISO
      ) {
        deliveredThisMonth.set(p.client_id, (deliveredThisMonth.get(p.client_id) ?? 0) + 1)
      }
    }
  }

  const rows: ContactRow[] = (clients ?? []).map(c => ({
    id: c.id,
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    logo_url: c.logo_url,
    status: c.status,
    target: deliverablesTarget(c),
    delivered: deliveredThisMonth.get(c.id) ?? 0,
    lastContent: lastContentByClient.get(c.id) ?? null,
    createdAt: c.created_at,
    portalUrl: c.portal_enabled && c.portal_token ? `/portail/${c.portal_token}` : null,
  }))

  const totalContacts    = rows.length
  const actifsCount      = rows.filter(r => r.status === 'actif').length
  const livrablesDuMois  = rows.filter(r => r.status === 'actif').reduce((s, r) => s + r.target, 0)
  const livresDuMois     = rows.reduce((s, r) => s + r.delivered, 0)

  const stats = [
    { label: 'Total de contacts',          value: totalContacts },
    { label: 'Actifs',                     value: actifsCount },
    { label: 'Livrables du mois (total)',  value: livrablesDuMois },
    { label: 'Filmés / publiés ce mois',   value: livresDuMois },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">{totalContacts} contact{totalContacts !== 1 ? 's' : ''} enregistré{totalContacts !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && (
          <Link href="/dashboard/clients/nouveau" className="btn-primary">
            <Plus className="w-4 h-4" />
            Nouveau contact
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
            {notYetOnTeam ? 'Pas encore assigné à une équipe' : 'Aucun contact'}
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            {notYetOnTeam
              ? 'Un owner ou director doit vous placer dans une équipe pour voir des contacts.'
              : !canCreate
                ? 'Aucun contact n\'est encore assigné à votre équipe.'
                : 'Ajoute ton premier contact pour commencer'}
          </p>
          {canCreate && (
            <Link href="/dashboard/clients/nouveau" className="btn-primary inline-flex">
              <Plus className="w-4 h-4" />
              Ajouter un contact
            </Link>
          )}
        </div>
      ) : (
        <ContactsTable rows={rows} stats={stats} />
      )}
    </div>
  )
}
