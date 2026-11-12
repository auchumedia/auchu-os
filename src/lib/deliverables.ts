// ══════════════════════════════════════════════════════════════════════════════
// Report automatique des livrables — fonctions PURES et testables (aucune
// dépendance : pas de Supabase, pas de Date.now(), pas d'horloge système ;
// tout ce qui varie dans le temps est passé en paramètre).
//
// Règle : les livrables non livrés un mois s'accumulent sur les mois
// suivants. Appliquée séparément pour short_form et long_form (cf.
// computeDeliverableTypeState) — un client a donc deux soldes indépendants.
//
// Testé par scripts/test-deliverables.mts (retard simple, surplus/crédit,
// client démarré en cours d'année, mois sans livrable, short/long séparés).
// ══════════════════════════════════════════════════════════════════════════════

export interface MonthKey {
  year: number
  month: number // 1-12
}

export function monthKeyFromDate(d: Date | string): MonthKey {
  const date = typeof d === 'string' ? new Date(d) : d
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

// Accepte 'YYYY-MM' ou 'YYYY-MM-DD' (les dates Postgres 'date' arrivent au
// format 'YYYY-MM-DD' côté JS) — ne dépend jamais du fuseau horaire local
// contrairement à `new Date('YYYY-MM-DD')`, qui interprète en UTC.
export function monthKeyFromString(s: string): MonthKey {
  const [yearStr, monthStr] = s.split('-')
  return { year: Number(yearStr), month: Number(monthStr) }
}

export function monthKeyToParam(k: MonthKey): string {
  return `${k.year}-${String(k.month).padStart(2, '0')}`
}

export function compareMonthKeys(a: MonthKey, b: MonthKey): number {
  if (a.year !== b.year) return a.year - b.year
  return a.month - b.month
}

export function addMonths(k: MonthKey, n: number): MonthKey {
  const total = (k.year * 12 + (k.month - 1)) + n
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

// Nombre de mois entre `start` et `end` inclus (ex: janvier→janvier = 1,
// janvier→mars = 3). 0 ou négatif si `end` est avant `start` (le client n'a
// pas encore commencé ce mois-là — aucun livrable n'est dû).
export function monthsBetweenInclusive(start: MonthKey, end: MonthKey): number {
  return (end.year - start.year) * 12 + (end.month - start.month) + 1
}

export interface DeliverableTypeResult {
  quota: number       // livrables/mois pour ce type (deliverables_short_form ou _long_form)
  due: number          // "Y" affiché pour le mois ciblé = quota + retard reporté du mois précédent
  delivered: number    // "X" affiché = livré PENDANT le mois ciblé seulement
  balance: number      // dû cumulé − livré cumulé + ajustement manuel, jusqu'au mois ciblé inclus (>0 retard, <0 crédit)
  late: number         // max(0, balance) — retard cumulé à la fin du mois ciblé
  credit: number       // max(0, -balance) — avance/crédit cumulé à la fin du mois ciblé
  manualAdjustment: number // tel que passé en paramètre — répété ici pour l'affichage ("ajustement manuel : +2")
}

export interface DeliverableTypeParams {
  perMonth: number              // deliverables_short_form ou deliverables_long_form
  startMonth: MonthKey          // mois de départ du client pour ce calcul
  targetMonth: MonthKey         // mois affiché (peut être un mois passé)
  deliveredMonths: MonthKey[]   // un élément par contenu "filme" ou "publie" de ce type, son mois assigné
  manualAdjustment?: number     // + ou - ajouté au solde cumulé (deliverables_short/long_adjustment, migration 051) — corrige les cas où l'historique réel ne colle pas aux content_pieces, sans en modifier aucun. Défaut 0.
}

// Calcule due_cumulé(M) = quota × mois_écoulés(M), livré_cumulé(M) = nombre
// de deliveredMonths ≤ M, puis balance(M) = due_cumulé − livré_cumulé +
// manualAdjustment (constant, s'applique à tous les mois également — c'est
// une correction permanente du solde, pas un ajustement ponctuel d'un mois).
// Le "dû affiché" pour M ajoute seulement le retard (positif) du mois
// précédent au quota du mois ; un crédit du mois précédent réduit le dû du
// mois courant (jusqu'à 0, jamais négatif).
export function computeDeliverableTypeState(params: DeliverableTypeParams): DeliverableTypeResult {
  const { perMonth, startMonth, targetMonth, deliveredMonths, manualAdjustment = 0 } = params

  const monthsElapsed = monthsBetweenInclusive(startMonth, targetMonth)
  if (monthsElapsed <= 0) {
    // Mois antérieur au départ du client — rien n'est dû, rien n'est compté
    // comme livré pour ce calcul (pas de retard "fictif" avant le départ).
    // L'ajustement manuel ne s'applique pas non plus avant le départ.
    return { quota: perMonth, due: 0, delivered: 0, balance: 0, late: 0, credit: 0, manualAdjustment }
  }

  const dueCumulative = perMonth * monthsElapsed
  const deliveredCumulative = deliveredMonths.filter(m => compareMonthKeys(m, targetMonth) <= 0).length
  const balance = dueCumulative - deliveredCumulative + manualAdjustment

  const prevMonth = addMonths(targetMonth, -1)
  const monthsElapsedPrev = monthsBetweenInclusive(startMonth, prevMonth)
  let balancePrev = 0
  if (monthsElapsedPrev > 0) {
    const dueCumulativePrev = perMonth * monthsElapsedPrev
    const deliveredCumulativePrev = deliveredMonths.filter(m => compareMonthKeys(m, prevMonth) <= 0).length
    balancePrev = dueCumulativePrev - deliveredCumulativePrev + manualAdjustment
  }

  const due = Math.max(0, perMonth + balancePrev)
  const deliveredInTargetMonth = deliveredMonths.filter(m => compareMonthKeys(m, targetMonth) === 0).length

  return {
    quota: perMonth,
    due,
    delivered: deliveredInTargetMonth,
    balance,
    late: Math.max(0, balance),
    credit: Math.max(0, -balance),
    manualAdjustment,
  }
}

export interface ClientDeliverablesResult {
  shortForm: DeliverableTypeResult
  longForm: DeliverableTypeResult
  totalDue: number
  totalDelivered: number
  totalLate: number
  totalCredit: number
}

export interface ClientDeliverablesParams {
  deliverablesShortForm: number
  deliverablesLongForm: number
  startMonth: MonthKey
  targetMonth: MonthKey
  deliveredShortFormMonths: MonthKey[]
  deliveredLongFormMonths: MonthKey[]
  shortFormAdjustment?: number // deliverables_short_adjustment (migration 051)
  longFormAdjustment?: number  // deliverables_long_adjustment (migration 051)
}

// short_form et long_form sont calculés indépendamment (deux soldes
// séparés) puis simplement additionnés pour les totaux affichés.
export function computeClientDeliverables(params: ClientDeliverablesParams): ClientDeliverablesResult {
  const shortForm = computeDeliverableTypeState({
    perMonth: params.deliverablesShortForm,
    startMonth: params.startMonth,
    targetMonth: params.targetMonth,
    deliveredMonths: params.deliveredShortFormMonths,
    manualAdjustment: params.shortFormAdjustment,
  })
  const longForm = computeDeliverableTypeState({
    perMonth: params.deliverablesLongForm,
    startMonth: params.startMonth,
    targetMonth: params.targetMonth,
    deliveredMonths: params.deliveredLongFormMonths,
    manualAdjustment: params.longFormAdjustment,
  })

  return {
    shortForm,
    longForm,
    totalDue: shortForm.due + longForm.due,
    totalDelivered: shortForm.delivered + longForm.delivered,
    totalLate: shortForm.late + longForm.late,
    totalCredit: shortForm.credit + longForm.credit,
  }
}
