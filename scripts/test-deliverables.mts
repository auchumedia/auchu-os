// ══════════════════════════════════════════════════════════════════════════════
// Test local de src/lib/deliverables.ts (fonctions pures — pas de réseau,
// pas de base de données). Lancer : node scripts/test-deliverables.mts
// (ou npm run test:deliverables)
// ══════════════════════════════════════════════════════════════════════════════

import {
  computeDeliverableTypeState, computeClientDeliverables,
  monthKeyFromString, addMonths, monthsBetweenInclusive,
  type MonthKey,
} from '../src/lib/deliverables.ts'

let failures = 0

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`)
  } else {
    console.log(`  ✗ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`)
    failures++
  }
}

function m(s: string): MonthKey {
  return monthKeyFromString(s)
}

console.log('Test 1 — retard simple (6 dues en octobre, 4 livrées → novembre affiche 6+2=8)')
{
  const start = m('2026-10')
  const delivered = [m('2026-10'), m('2026-10'), m('2026-10'), m('2026-10')] // 4 en octobre

  const oct = computeDeliverableTypeState({ perMonth: 6, startMonth: start, targetMonth: m('2026-10'), deliveredMonths: delivered })
  assertEqual(oct.due, 6, 'octobre : dû = 6 (premier mois, aucun report)')
  assertEqual(oct.delivered, 4, 'octobre : livré = 4')
  assertEqual(oct.late, 2, 'octobre : retard cumulé = 2')

  const nov = computeDeliverableTypeState({ perMonth: 6, startMonth: start, targetMonth: m('2026-11'), deliveredMonths: delivered })
  assertEqual(nov.due, 8, "novembre : dû affiché = 6 (quota) + 2 (retard d'octobre) = 8")
  assertEqual(nov.delivered, 0, 'novembre : rien livré en novembre spécifiquement')
  assertEqual(nov.late, 8, 'novembre : retard cumulé = 12 dus − 4 livrés = 8')
}

console.log('\nTest 2 — surplus/crédit (6 dues en octobre, 8 livrées → novembre réduit à 4)')
{
  const start = m('2026-10')
  const delivered = Array(8).fill(m('2026-10')) // 8 livrées en octobre, quota 6

  const oct = computeDeliverableTypeState({ perMonth: 6, startMonth: start, targetMonth: m('2026-10'), deliveredMonths: delivered })
  assertEqual(oct.credit, 2, 'octobre : crédit cumulé = 2 (8 livrées − 6 dues)')
  assertEqual(oct.late, 0, 'octobre : pas de retard')

  const nov = computeDeliverableTypeState({ perMonth: 6, startMonth: start, targetMonth: m('2026-11'), deliveredMonths: delivered })
  assertEqual(nov.due, 4, "novembre : dû affiché = 6 (quota) − 2 (crédit d'octobre) = 4")
  // Rien de nouveau livré en novembre : le crédit de 2 (fin octobre) absorbe
  // une partie du quota de novembre (dû affiché 4) mais ne suffit pas à
  // couvrir tout le quota — dû cumulé 12 vs livré cumulé 8 → retard 4,
  // le solde bascule de crédit à retard.
  assertEqual(nov.late, 4, 'novembre : dû cumulé 12 − livré cumulé 8 = retard 4 (le crédit ne suffit plus)')
  assertEqual(nov.credit, 0, 'novembre : plus de crédit, consommé par le nouveau quota')
}

console.log('\nTest 3 — crédit qui dépasse le quota du mois suivant (jamais de dû négatif)')
{
  const start = m('2026-01')
  const delivered = Array(20).fill(m('2026-01')) // énorme avance en janvier, quota 2

  const feb = computeDeliverableTypeState({ perMonth: 2, startMonth: start, targetMonth: m('2026-02'), deliveredMonths: delivered })
  assertEqual(feb.due, 0, 'février : dû ne descend jamais sous 0 même avec un crédit énorme')
  assertEqual(feb.credit, 16, 'février : crédit cumulé = 4 (dus) − 20 (livrés) = -16 → crédit 16')
}

console.log("\nTest 4 — client démarré en cours d'année (aucun retard fictif avant le départ)")
{
  const start = m('2026-08')

  const june = computeDeliverableTypeState({ perMonth: 4, startMonth: start, targetMonth: m('2026-06'), deliveredMonths: [] })
  assertEqual(june.due, 0, 'juin (avant le départ en août) : rien dû')
  assertEqual(june.late, 0, 'juin : aucun retard avant le départ du client')

  const aug = computeDeliverableTypeState({ perMonth: 4, startMonth: start, targetMonth: m('2026-08'), deliveredMonths: [] })
  assertEqual(aug.due, 4, "août (mois de départ) : dû = quota seul, pas de retard reporté")

  const sep = computeDeliverableTypeState({ perMonth: 4, startMonth: start, targetMonth: m('2026-09'), deliveredMonths: [] })
  assertEqual(sep.due, 8, 'septembre : 4 (quota) + 4 (retard reporté d\'août, rien livré) = 8')
}

console.log('\nTest 5 — mois sans livrable (quota = 0 → jamais rien dû)')
{
  const start = m('2026-01')
  const noQuota = computeDeliverableTypeState({ perMonth: 0, startMonth: start, targetMonth: m('2026-06'), deliveredMonths: [] })
  assertEqual(noQuota.due, 0, 'quota 0 : rien dû, quel que soit le mois')
  assertEqual(noQuota.late, 0, 'quota 0 : jamais de retard')
}

console.log('\nTest 6 — short_form et long_form calculés séparément (computeClientDeliverables)')
{
  const start = m('2026-01')
  const result = computeClientDeliverables({
    deliverablesShortForm: 6,
    deliverablesLongForm: 2,
    startMonth: start,
    targetMonth: m('2026-02'),
    deliveredShortFormMonths: [m('2026-01'), m('2026-01'), m('2026-01'), m('2026-01')], // 4/6 en janvier → retard 2
    deliveredLongFormMonths: [m('2026-01'), m('2026-01'), m('2026-01')],                 // 3/2 en janvier → crédit 1
  })
  assertEqual(result.shortForm.due, 8, "short_form février : dû affiché = 6 (quota) + 2 (retard reporté de janvier) = 8")
  assertEqual(result.longForm.due, 1, "long_form février : dû affiché = 2 (quota) − 1 (crédit reporté de janvier) = 1")
  assertEqual(result.totalDue, 9, 'total février : 8 (short) + 1 (long) = 9')
  // .late/.credit sont des soldes CUMULÉS à fin février (pas "le retard
  // reporté du mois précédent" ci-dessus) : short_form 12 dus − 4 livrés au
  // total = 8 de retard ; long_form 4 dus − 3 livrés au total = 1 de retard
  // (le crédit de janvier a été absorbé par le nouveau quota de février).
  assertEqual(result.shortForm.late, 8, 'short_form : retard cumulé à fin février = 12 dus − 4 livrés = 8')
  assertEqual(result.longForm.late, 1, 'long_form : retard cumulé à fin février = 4 dus − 3 livrés = 1 (crédit absorbé)')
  assertEqual(result.shortForm.credit, 0, 'short_form : aucun crédit (en retard, pas en avance)')
  assertEqual(result.longForm.credit, 0, "long_form : aucun crédit à fin février (n'affecte pas le short_form, qui a son propre solde)")
}

console.log('\nTest 7 — helpers MonthKey (mois écoulés, addMonths)')
{
  assertEqual(monthsBetweenInclusive(m('2026-01'), m('2026-01')), 1, 'janvier→janvier = 1 mois')
  assertEqual(monthsBetweenInclusive(m('2026-01'), m('2026-03')), 3, 'janvier→mars = 3 mois')
  assertEqual(monthsBetweenInclusive(m('2026-03'), m('2026-01')), -1, 'mars→janvier = -1 (avant le départ)')
  assertEqual(JSON.stringify(addMonths(m('2026-12'), 1)), JSON.stringify(m('2027-01')), 'addMonths gère le changement d\'année')
  assertEqual(JSON.stringify(addMonths(m('2026-01'), -1)), JSON.stringify(m('2025-12')), 'addMonths négatif gère le changement d\'année')
}

console.log(failures === 0 ? '\n✅ Tous les tests passent.' : `\n❌ ${failures} test(s) en échec.`)
process.exitCode = failures === 0 ? 0 : 1
