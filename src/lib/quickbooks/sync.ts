import { qboFetch } from './client'
import { getConnection } from './connection'
import { QuickBooksReconnectRequiredError, QuickBooksNotConnectedError, QuickBooksApiError } from './errors'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/finance'
import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const PAGE_SIZE = 100

// ── Mapping catégorie de dépense ← nom de compte QuickBooks (mots-clés) ────────
const CATEGORY_KEYWORDS: Partial<Record<ExpenseCategory, string[]>> = {
  'Logiciels':      ['software', 'saas', 'subscription', 'licence', 'license', 'app', 'hosting', 'hébergement', 'adobe', 'workspace', 'microsoft', 'cloud'],
  'Sous-traitants':  ['contractor', 'freelance', 'pigiste', 'sous-traitant', 'consultant', 'agency', 'outsourc'],
  'Matériel':       ['equipment', 'hardware', 'matériel', 'materiel', 'computer', 'ordinateur', 'camera', 'caméra', 'gear', 'furniture', 'mobilier'],
  'Publicité':      ['advertising', 'ads', 'publicité', 'publicite', 'marketing', 'promo'],
  'Déplacements':   ['travel', 'transport', 'déplacement', 'deplacement', 'mileage', 'uber', 'taxi', 'parking', 'hotel', 'hôtel', 'flight', 'vol', 'essence', 'gas', 'fuel'],
  'Bureau':         ['office', 'bureau', 'rent', 'loyer', 'supplies', 'fourniture', 'utilities', 'utilit', 'electricity', 'électricité', 'internet'],
  'Taxes':          ['tax', 'taxe', 'tps', 'tvq', 'gst', 'hst', 'qst', 'impôt', 'impot', 'revenu québec', 'cra', 'irs'],
}

export function mapExpenseCategory(accountName: string | null | undefined): ExpenseCategory {
  if (!accountName) return 'Autre'
  const name = accountName.toLowerCase()
  for (const category of EXPENSE_CATEGORIES) {
    const keywords = CATEGORY_KEYWORDS[category]
    if (keywords?.some(k => name.includes(k))) return category
  }
  return 'Autre'
}

// ── Formes QuickBooks minimales (lecture seule, défensives — tous les champs
//    optionnels sauf Id/TxnDate/TotalAmt, pour ne jamais planter sur une
//    variation de forme entre comptes QuickBooks). ──────────────────────────
interface QboAccountLine {
  AccountBasedExpenseLineDetail?: { AccountRef?: { name?: string } }
}
interface QboInvoice {
  Id: string
  DocNumber?: string
  TxnDate: string
  TotalAmt: number
  CustomerRef?: { name?: string }
}
interface QboPurchase {
  Id: string
  DocNumber?: string
  TxnDate: string
  TotalAmt: number
  EntityRef?: { name?: string }
  Line?: QboAccountLine[]
}
interface QboBill {
  Id: string
  DocNumber?: string
  TxnDate: string
  TotalAmt: number
  VendorRef?: { name?: string }
  Line?: QboAccountLine[]
}

function twelveMonthsAgoISO(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().split('T')[0]
}
function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// Pagination QuickBooks — STARTPOSITION/MAXRESULTS, boucle jusqu'à une page
// incomplète (point 3 du questionnaire : "utilise qboFetch() avec pagination").
async function queryAll<T>(ownerId: string, entity: string, whereClause: string): Promise<T[]> {
  const results: T[] = []
  let startPosition = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const q = `SELECT * FROM ${entity} WHERE ${whereClause} ORDERBY TxnDate STARTPOSITION ${startPosition} MAXRESULTS ${PAGE_SIZE}`
    const data = await qboFetch<{ QueryResponse?: Record<string, T[]> }>(ownerId, `/query?query=${encodeURIComponent(q)}`)
    const rows = data?.QueryResponse?.[entity] ?? []
    results.push(...rows)
    if (rows.length < PAGE_SIZE) break
    startPosition += PAGE_SIZE
  }
  return results
}

async function buildClientNameMap(supabase: SupabaseClient, ownerId: string): Promise<Map<string, string>> {
  const { data } = await supabase.from('clients').select('id, name').eq('user_id', ownerId)
  const map = new Map<string, string>()
  for (const c of data ?? []) map.set(c.name.toLowerCase().trim(), c.id)
  return map
}

// external_id embarque le realm_id ("inv_{realmId}_{Id}", etc.) — un realm_id
// identifie de façon unique une entreprise QuickBooks dans un environnement
// donné (sandbox et production n'ont jamais le même realm_id), donc comparer
// le realm_id suffit à détecter un changement d'entreprise OU d'environnement.
function realmIdFromExternalId(externalId: string): string | null {
  const parts = externalId.split('_')
  return parts.length >= 3 ? parts[1] : null
}

// Supprime les lignes importées d'un ancien realm_id (changement
// d'entreprise ou d'environnement sandbox↔production) avant de synchroniser
// — ne touche jamais les entrées manuelles (filtrées par source='quickbooks').
async function purgeStaleRealmData(supabase: SupabaseClient, ownerId: string, currentRealmId: string) {
  for (const table of ['finance_revenues', 'finance_expenses'] as const) {
    const { data } = await supabase
      .from(table)
      .select('id, external_id')
      .eq('user_id', ownerId)
      .eq('source', 'quickbooks')

    const staleIds = (data ?? [])
      .filter(row => row.external_id && realmIdFromExternalId(row.external_id) !== currentRealmId)
      .map(row => row.id)

    if (staleIds.length > 0) {
      const { error } = await supabase.from(table).delete().in('id', staleIds)
      if (error) throw new Error(`[quickbooks/sync] purge ${table} (changement d'entreprise/environnement) échouée — ${error.message}`)
    }
  }
}

// Met à jour une ligne déjà importée (même user_id/source/external_id) ou en
// insère une nouvelle — ne touche JAMAIS une entrée manuelle : le filtre
// `source = 'quickbooks'` l'exclut par construction (les entrées manuelles
// ont source = 'manual' et external_id = null).
async function upsertSyncedEntry(
  supabase: SupabaseClient, table: 'finance_revenues' | 'finance_expenses', ownerId: string, externalId: string, row: Record<string, unknown>,
) {
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq('user_id', ownerId)
    .eq('source', 'quickbooks')
    .eq('external_id', externalId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from(table).update(row).eq('id', existing.id)
    if (error) throw new Error(`[quickbooks/sync] mise à jour ${table} ${externalId} échouée — ${error.message}`)
  } else {
    const { error } = await supabase.from(table).insert({ user_id: ownerId, source: 'quickbooks', external_id: externalId, ...row })
    if (error) throw new Error(`[quickbooks/sync] insertion ${table} ${externalId} échouée — ${error.message}`)
  }
}

export interface QuickBooksSyncResult {
  revenuesSynced: number
  expensesSynced: number
  // Un message par ressource (Invoice/Purchase/Bill) qui a échoué sans
  // bloquer le reste de la synchro — ex: "Bill (factures fournisseurs)
  // indisponible — HTTP 400" quand le forfait QuickBooks n'inclut pas cette
  // fonctionnalité. Vide si tout a réussi.
  errors: string[]
}

// Erreurs de jeton — restent bloquantes : on les relance immédiatement pour
// que syncQuickBooksData() (et la route appelante) les traite comme avant
// (statut "reconnect_required", bouton Reconnecter). Toute AUTRE erreur sur
// une ressource (400/403 "non disponible pour ce forfait", 404, etc.) est
// non bloquante — cf. isolation par ressource ci-dessous.
function isBlockingTokenError(e: unknown): boolean {
  return e instanceof QuickBooksReconnectRequiredError || e instanceof QuickBooksNotConnectedError
}

// L'erreur est déjà journalisée en détail par logQuickBooksApiError() au
// moment où qboFetch() l'a levée — ce message ne fait que résumer l'essentiel
// (statut, code Intuit, intuit_tid) pour last_error, afin de pouvoir donner
// l'intuit_tid au support sans avoir à aller chercher dans les logs serveur.
function describeResourceFailure(label: string, e: unknown): string {
  if (e instanceof QuickBooksApiError) {
    const codePart = e.intuitCode ? ` [code ${e.intuitCode}]` : ''
    const tidPart = e.intuitTid ? ` (intuit_tid: ${e.intuitTid})` : ''
    return `${label} indisponible — HTTP ${e.status}${codePart}: ${e.message}${tidPart}`
  }
  const reason = e instanceof Error ? e.message : String(e)
  return `${label} indisponible — ${reason}`
}

// Synchronise les 12 derniers mois — Invoice → finance_revenues, Purchase +
// Bill → finance_expenses. Chaque ressource est lue indépendamment : si
// l'une échoue (non disponible pour le forfait de l'entreprise, erreur
// 400/403 ou autre), la synchro continue avec les autres plutôt que de tout
// annuler — seule une erreur de jeton (reconnexion requise) interrompt tout.
// supabase est le client lié à la session (RLS owner/director, migration
// 047) : jamais le client admin ici, finance_revenues/finance_expenses
// n'ont pas besoin de service_role.
export async function syncQuickBooksData(supabase: SupabaseClient, ownerId: string): Promise<QuickBooksSyncResult> {
  // Résout le realm_id courant pour (a) détecter un changement d'entreprise/
  // environnement et purger les données de l'ancien realm avant de
  // synchroniser, et (b) l'embarquer dans chaque external_id généré ci-dessous.
  const connection = await getConnection(ownerId)
  const realmId = connection?.realmId ?? null
  if (realmId) await purgeStaleRealmData(supabase, ownerId, realmId)

  const where = `TxnDate >= '${twelveMonthsAgoISO()}' AND TxnDate <= '${todayISO()}'`
  const clientByName = await buildClientNameMap(supabase, ownerId)

  const errors: string[] = []
  let revenuesSynced = 0
  let expensesSynced = 0

  // ── Invoice → finance_revenues ────────────────────────────────────────────
  try {
    const invoices = await queryAll<QboInvoice>(ownerId, 'Invoice', where)
    for (const inv of invoices) {
      const customerName = inv.CustomerRef?.name?.toLowerCase().trim()
      const clientId = customerName ? clientByName.get(customerName) ?? null : null
      await upsertSyncedEntry(supabase, 'finance_revenues', ownerId, `inv_${realmId}_${inv.Id}`, {
        amount: inv.TotalAmt,
        entry_date: inv.TxnDate,
        description: inv.DocNumber ? `Facture ${inv.DocNumber}` : `Facture QuickBooks ${inv.Id}`,
        client_id: clientId,
      })
    }
    revenuesSynced = invoices.length
  } catch (e) {
    if (isBlockingTokenError(e)) throw e
    errors.push(describeResourceFailure('Invoice (factures)', e))
  }

  // ── Purchase → finance_expenses ───────────────────────────────────────────
  try {
    const purchases = await queryAll<QboPurchase>(ownerId, 'Purchase', where)
    for (const p of purchases) {
      const accountName = p.Line?.find(l => l.AccountBasedExpenseLineDetail?.AccountRef?.name)?.AccountBasedExpenseLineDetail?.AccountRef?.name
      await upsertSyncedEntry(supabase, 'finance_expenses', ownerId, `pur_${realmId}_${p.Id}`, {
        amount: p.TotalAmt,
        entry_date: p.TxnDate,
        category: mapExpenseCategory(accountName),
        description: p.EntityRef?.name ?? (p.DocNumber ? `Achat ${p.DocNumber}` : `Achat QuickBooks ${p.Id}`),
      })
    }
    expensesSynced += purchases.length
  } catch (e) {
    if (isBlockingTokenError(e)) throw e
    errors.push(describeResourceFailure('Purchase (achats)', e))
  }

  // ── Bill → finance_expenses ────────────────────────────────────────────────
  try {
    const bills = await queryAll<QboBill>(ownerId, 'Bill', where)
    for (const b of bills) {
      const accountName = b.Line?.find(l => l.AccountBasedExpenseLineDetail?.AccountRef?.name)?.AccountBasedExpenseLineDetail?.AccountRef?.name
      await upsertSyncedEntry(supabase, 'finance_expenses', ownerId, `bill_${realmId}_${b.Id}`, {
        amount: b.TotalAmt,
        entry_date: b.TxnDate,
        category: mapExpenseCategory(accountName),
        description: b.VendorRef?.name ?? (b.DocNumber ? `Facture fournisseur ${b.DocNumber}` : `Facture fournisseur QuickBooks ${b.Id}`),
      })
    }
    expensesSynced += bills.length
  } catch (e) {
    if (isBlockingTokenError(e)) throw e
    errors.push(describeResourceFailure('Bill (factures fournisseurs)', e))
  }

  return { revenuesSynced, expensesSynced, errors }
}
