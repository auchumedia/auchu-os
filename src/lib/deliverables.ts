// ══════════════════════════════════════════════════════════════════════════════
// Report automatique des livrables — fonctions PURES et testables (aucune
// dépendance : pas de Supabase, pas de Date.now(), pas d'horloge système ;
// tout ce qui varie dans le temps est passé en paramètre, y compris le mois
// "aujourd'hui" (currentMonth) nécessaire pour distinguer un mois entièrement
// passé d'un mois en cours/futur).
//
// Règles métier (vérité business, cf. historique de ce fichier) :
//  1. Le quota du mois ciblé n'est JAMAIS du retard tant que ce mois n'est
//     pas terminé — en novembre, les livrables de novembre sont "à faire",
//     pas "en retard".
//  2. Retard = ce qui manquait à la fin des mois PASSÉS (backlog B), diminué
//     de ce qui a été livré depuis. Crédit (C) = avance livrée au-delà du dû
//     des mois passés — B et C sont mutuellement exclusifs. L'ajustement
//     manuel s'ajoute au backlog (+ = dû en plus, − = crédit).
//  3. "Livré" = statut filme OU publie.
//  4. À livrer (mois M) = quota(M) + B. Livré affiché (mois M) = livrés
//     dans M + C — jamais le due diminué du crédit : le crédit vient
//     gonfler ce qui est déjà considéré comme livré pour M.
//  5. Badge "N en retard" = max(0, B − livrés dans M) pour un mois en cours
//     ou futur (le quota de M n'y entre jamais). Pour un mois entièrement
//     passé, retard = à livrer − livré (le quota de ce mois compte, il ne
//     reviendra plus).
//  6. Le badge ne s'affiche que s'il est > 0.
//  7. Mêmes règles pour short_form et long_form (soldes indépendants). Tout
//     contenu livré avant le mois de départ du client est ignoré (ni dû, ni
//     livré, ni crédit).
//
// Testé par scripts/test-deliverables.mts.
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
  quota: number            // livrables/mois pour ce type (deliverables_short_form ou _long_form)
  due: number              // "à livrer" affiché = quota(M) + backlog — jamais réduit par le crédit
  delivered: number        // "livré" affiché = livrés dans M + crédit
  backlog: number          // B — retard hérité des mois avant M (inclut l'ajustement manuel positif)
  credit: number           // C — avance héritée des mois avant M (inclut l'ajustement manuel négatif)
  late: number             // badge "N en retard" — 0 si rien à signaler (règle 6)
  manualAdjustment: number // tel que passé en paramètre — répété ici pour l'affichage ("ajustement manuel : +2")
}

export interface DeliverableTypeParams {
  perMonth: number              // deliverables_short_form ou deliverables_long_form
  startMonth: MonthKey          // mois de départ du client pour ce calcul
  targetMonth: MonthKey         // mois affiché (peut être un mois passé ou futur)
  currentMonth: MonthKey        // mois réel "aujourd'hui" — distingue un mois de targetMonth entièrement passé d'un mois en cours/futur (règles 1 et 5)
  deliveredMonths: MonthKey[]   // un élément par contenu "filme" ou "publie" de ce type, son mois assigné
  manualAdjustment?: number     // + ou - ajouté au backlog (deliverables_short/long_adjustment, migration 051) — corrige les cas où l'historique réel ne colle pas aux content_pieces, sans en modifier aucun. Défaut 0.
}

export function computeDeliverableTypeState(params: DeliverableTypeParams): DeliverableTypeResult {
  const { perMonth, startMonth, targetMonth, currentMonth, deliveredMonths, manualAdjustment = 0 } = params

  const monthsElapsed = monthsBetweenInclusive(startMonth, targetMonth)
  if (monthsElapsed <= 0) {
    // Mois antérieur au départ du client — rien n'est dû, rien n'est compté
    // comme livré pour ce calcul (pas de retard "fictif" avant le départ).
    return { quota: perMonth, due: 0, delivered: 0, backlog: 0, credit: 0, late: 0, manualAdjustment }
  }

  // Un contenu livré pour un mois antérieur au départ du client ne compte
  // ni comme dû, ni comme livré, ni comme crédit — il est simplement ignoré
  // (ex. ancien contenu produit avant le début officiel du forfait).
  const isCounted = (month: MonthKey) => compareMonthKeys(month, startMonth) >= 0

  const deliveredInTargetMonth = deliveredMonths.filter(m => isCounted(m) && compareMonthKeys(m, targetMonth) === 0).length

  // Backlog (B) / crédit (C) hérités des mois STRICTEMENT avant M — mutuellement
  // exclusifs. C'est le solde cumulé (dû − livré + ajustement manuel) à la
  // fin du mois précédent M, jamais celui de M lui-même (règle 1 : le quota
  // de M n'est jamais inclus dans ce qui précède M).
  const prevMonth = addMonths(targetMonth, -1)
  const monthsElapsedPrev = monthsBetweenInclusive(startMonth, prevMonth)
  let balancePrev = 0
  if (monthsElapsedPrev > 0) {
    const dueCumulativePrev = perMonth * monthsElapsedPrev
    const deliveredCumulativePrev = deliveredMonths.filter(m => isCounted(m) && compareMonthKeys(m, prevMonth) <= 0).length
    balancePrev = dueCumulativePrev - deliveredCumulativePrev + manualAdjustment
  }
  const backlog = Math.max(0, balancePrev)
  const credit = Math.max(0, -balancePrev)

  // Règle 4 : "à livrer" ajoute le backlog au quota (jamais réduit par le
  // crédit) ; "livré" affiché ajoute le crédit à ce qui a été livré ce mois.
  const due = perMonth + backlog
  const delivered = deliveredInTargetMonth + credit

  // Règles 1/5 : tant que M n'est pas terminé (en cours ou futur), le quota
  // de M n'est jamais du retard — seul le backlog hérité, diminué de ce qui
  // a déjà été livré CE mois, compte (le crédit n'entre pas non plus : B et
  // C sont mutuellement exclusifs, C vaut 0 dès que B > 0). Pour un mois
  // entièrement passé, le retard est la différence simple à livrer − livré
  // (le quota de ce mois ne reviendra plus, donc il compte pleinement).
  const monthIsOver = compareMonthKeys(targetMonth, currentMonth) < 0
  const late = monthIsOver
    ? Math.max(0, due - delivered)
    : Math.max(0, backlog - deliveredInTargetMonth)

  return { quota: perMonth, due, delivered, backlog, credit, late, manualAdjustment }
}

export interface ClientDeliverablesResult {
  shortForm: DeliverableTypeResult
  longForm: DeliverableTypeResult
  totalDue: number
  totalDelivered: number
  totalLate: number
}

export interface ClientDeliverablesParams {
  deliverablesShortForm: number
  deliverablesLongForm: number
  startMonth: MonthKey
  targetMonth: MonthKey
  currentMonth: MonthKey
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
    currentMonth: params.currentMonth,
    deliveredMonths: params.deliveredShortFormMonths,
    manualAdjustment: params.shortFormAdjustment,
  })
  const longForm = computeDeliverableTypeState({
    perMonth: params.deliverablesLongForm,
    startMonth: params.startMonth,
    targetMonth: params.targetMonth,
    currentMonth: params.currentMonth,
    deliveredMonths: params.deliveredLongFormMonths,
    manualAdjustment: params.longFormAdjustment,
  })

  return {
    shortForm,
    longForm,
    totalDue: shortForm.due + longForm.due,
    totalDelivered: shortForm.delivered + longForm.delivered,
    totalLate: shortForm.late + longForm.late,
  }
}
