import { computeClientDeliverables, monthKeyFromDate, monthKeyFromString, type MonthKey } from './deliverables'
import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface ClientDeliverableRow {
  id: string
  name: string
  logo_url: string | null
  shortForm: ReturnType<typeof computeClientDeliverables>['shortForm']
  longForm: ReturnType<typeof computeClientDeliverables>['longForm']
  shortFormAdjustmentNote: string | null
  longFormAdjustmentNote: string | null
  totalDue: number
  totalDelivered: number
  totalLate: number
}

export interface DeliverablesAggregate {
  shortDue: number
  shortDelivered: number
  longDue: number
  longDelivered: number
}

export interface DeliverablesResult {
  rows: ClientDeliverableRow[]
  aggregate: DeliverablesAggregate
}

// Livré = statut "filme" OU "publie" (une vidéo déjà tournée mais pas
// encore publiée compte quand même comme livrée) ; mois assigné =
// month_target (choisi à la création de l'idée), avec repli sur created_at
// pour les lignes antérieures à l'ajout de cette colonne (migration 042).
function assignedMonth(piece: { month_target: string | null; created_at: string }): MonthKey {
  return piece.month_target ? monthKeyFromString(piece.month_target) : monthKeyFromDate(piece.created_at)
}

// Mois de départ du client : deliverables_start_month si renseigné, sinon
// le mois de created_at (migration 050).
function clientStartMonth(client: { deliverables_start_month: string | null; created_at: string }): MonthKey {
  return client.deliverables_start_month
    ? monthKeyFromString(client.deliverables_start_month)
    : monthKeyFromDate(client.created_at)
}

// clientIds === null : pas de filtrage (owner/director, toute l'org).
// clientIds === [...] : scopé à une équipe (stratege/monteur) — même
// convention que fetchClientCards/fetchUpcomingEvents (dashboard/page.tsx).
//
// currentMonth = mois réel "aujourd'hui", distinct de targetMonth (le mois
// affiché, que l'utilisateur peut faire défiler) — nécessaire pour que le
// calcul sache si targetMonth est entièrement passé (cf. deliverables.ts,
// règles 1 et 5 : le quota d'un mois en cours ou futur n'est jamais "en
// retard").
//
// Triées par retard total décroissant (les clients les plus en retard en
// premier), puis par nom.
export async function fetchClientDeliverableRows(
  supabase: SupabaseClient, ownerId: string, clientIds: string[] | null, targetMonth: MonthKey, currentMonth: MonthKey,
): Promise<DeliverablesResult> {
  let clientsQuery = supabase
    .from('clients')
    .select('id, name, logo_url, deliverables_short_form, deliverables_long_form, deliverables_start_month, created_at, deliverables_short_adjustment, deliverables_short_adjustment_note, deliverables_long_adjustment, deliverables_long_adjustment_note')
    .eq('user_id', ownerId)
    .eq('status', 'actif')
    .order('name')
  if (clientIds) clientsQuery = clientsQuery.in('id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: clients } = await clientsQuery
  const activeClients = (clients ?? []).filter(c => c.deliverables_short_form > 0 || c.deliverables_long_form > 0)

  if (activeClients.length === 0) {
    return { rows: [], aggregate: { shortDue: 0, shortDelivered: 0, longDue: 0, longDelivered: 0 } }
  }

  const ids = activeClients.map(c => c.id)

  // Tout l'historique "publie" est nécessaire pour le cumul (pas seulement
  // le mois ciblé) — un client actif depuis des mois reste un volume de
  // lignes modeste pour une agence, donc une seule requête ici reste simple
  // et correcte plutôt que d'optimiser prématurément.
  const { data: pieces } = await supabase
    .from('content_pieces')
    .select('client_id, type, month_target, created_at')
    .eq('user_id', ownerId)
    .in('status', ['filme', 'publie'])
    .in('client_id', ids)

  const deliveredByClient = new Map<string, { short: MonthKey[]; long: MonthKey[] }>()
  for (const p of pieces ?? []) {
    if (!p.client_id) continue
    const bucket = deliveredByClient.get(p.client_id) ?? { short: [], long: [] }
    const month = assignedMonth(p)
    if (p.type === 'long_form') bucket.long.push(month)
    else bucket.short.push(month)
    deliveredByClient.set(p.client_id, bucket)
  }

  const aggregate: DeliverablesAggregate = { shortDue: 0, shortDelivered: 0, longDue: 0, longDelivered: 0 }

  const rows: ClientDeliverableRow[] = activeClients.map(c => {
    const delivered = deliveredByClient.get(c.id) ?? { short: [], long: [] }
    const result = computeClientDeliverables({
      deliverablesShortForm: c.deliverables_short_form,
      deliverablesLongForm: c.deliverables_long_form,
      startMonth: clientStartMonth(c),
      targetMonth,
      currentMonth,
      deliveredShortFormMonths: delivered.short,
      deliveredLongFormMonths: delivered.long,
      shortFormAdjustment: c.deliverables_short_adjustment,
      longFormAdjustment: c.deliverables_long_adjustment,
    })

    aggregate.shortDue += result.shortForm.due
    aggregate.shortDelivered += result.shortForm.delivered
    aggregate.longDue += result.longForm.due
    aggregate.longDelivered += result.longForm.delivered

    return {
      id: c.id, name: c.name, logo_url: c.logo_url,
      shortForm: result.shortForm, longForm: result.longForm,
      shortFormAdjustmentNote: c.deliverables_short_adjustment_note,
      longFormAdjustmentNote: c.deliverables_long_adjustment_note,
      totalDue: result.totalDue, totalDelivered: result.totalDelivered,
      totalLate: result.totalLate,
    }
  })

  rows.sort((a, b) => b.totalLate - a.totalLate || a.name.localeCompare(b.name))

  return { rows, aggregate }
}
