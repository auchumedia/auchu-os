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

console.log('\nTest 8 — ajustement manuel (+2 appliqué uniformément, sur un solde déjà à zéro)')
{
  // Oct. à l'équilibre (4 dus, 4 livrées) ; l'ajustement +2 doit se
  // répercuter intégralement sur le dû de novembre (4 + 2 = 6).
  const delivered = Array(4).fill(m('2026-10'))
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), deliveredMonths: delivered, manualAdjustment: 2,
  })
  assertEqual(r.due, 6, 'novembre : dû = 4 (quota) + 2 (ajustement manuel) = 6')
  assertEqual(r.manualAdjustment, 2, "l'ajustement est répété dans le résultat pour l'affichage")
}

console.log('\nTest 9 — contenu livré AVANT le départ : ignoré (ni dû, ni livré, ni crédit)')
{
  // 5 "livrés" en septembre, avant le départ (octobre) — un bug plaçait ces
  // 5 dans le cumul livré de n'importe quel mois cible ≥ septembre, créant
  // un crédit fictif. Ils doivent maintenant être purement ignorés.
  const beforeStart = Array(5).fill(m('2026-09'))
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-10'), deliveredMonths: beforeStart,
  })
  assertEqual(r.delivered, 0, "septembre (avant le départ) n'est jamais compté comme livré en octobre")
  assertEqual(r.late, 4, 'octobre : dû = 4, rien livré en octobre lui-même → retard 4 (pas de crédit des 5 de septembre)')
  assertEqual(r.credit, 0, 'octobre : aucun crédit créé par du contenu antérieur au départ')

  // Mélange : 5 avant le départ (ignorés) + 2 après (comptés) → retard 2,
  // pas un crédit de 3 (4+1 avant - 2... ) : seuls les 2 d'octobre comptent.
  const mixed = [...Array(5).fill(m('2026-09')), ...Array(2).fill(m('2026-10'))]
  const mixedResult = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-10'), deliveredMonths: mixed,
  })
  assertEqual(mixedResult.delivered, 2, 'octobre : seuls les 2 livrés en octobre comptent (les 5 de septembre sont ignorés)')
  assertEqual(mixedResult.late, 2, 'octobre : dû 4 − livré 2 (compté) = retard 2')
}

// ── Cas réels novembre 2026 : tous les contacts repartent à zéro au 1er
// octobre 2026 (deliverables_start_month = '2026-10-01' pour tous — cf.
// migration 053). Tout contenu antérieur à octobre est ignoré (Test 9
// ci-dessus), peu importe son statut ou son volume — c'est inclus
// explicitement dans les tableaux `delivered` ci-dessous pour prouver que le
// calcul ne s'en sert pas.

console.log('\nTest 10 — cas réel : Bâton Rouge Vaudreuil (à jour → nov. dû = 4, retard 0)')
{
  // 4 publiées en septembre (avant le départ, ignorées) + 4 en octobre.
  const delivered = [...Array(4).fill(m('2026-09')), ...Array(4).fill(m('2026-10'))]
  const oct = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-10'), deliveredMonths: delivered })
  assertEqual(oct.late, 0, 'Bâton Rouge : aucun retard entrant en novembre')
  const nov = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), deliveredMonths: delivered })
  assertEqual(nov.due, 4, 'Bâton Rouge : novembre dû = 4')
}

console.log('\nTest 11 — cas réel : Groupe DDC (à jour → nov. dû = 4)')
{
  // 4 pièces statut "filme" en octobre (aucune "publie").
  const delivered = Array(4).fill(m('2026-10'))
  const oct = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-10'), deliveredMonths: delivered })
  assertEqual(oct.late, 0, 'Groupe DDC : aucun retard entrant en novembre')
  const nov = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), deliveredMonths: delivered })
  assertEqual(nov.due, 4, 'Groupe DDC : novembre dû = 4')
}

console.log('\nTest 12 — cas réel : Équipe Lemire Filion (2 vidéos d\'avance → nov. dû = 2)')
{
  // 6 pièces livrées en octobre (3 "publie" + 3 "filme") contre un quota de 4.
  const delivered = Array(6).fill(m('2026-10'))
  const oct = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-10'), deliveredMonths: delivered })
  assertEqual(oct.credit, 2, "Lemire Filion : 2 vidéos d'avance entrant en novembre")
  const nov = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), deliveredMonths: delivered })
  assertEqual(nov.due, 2, "Lemire Filion : novembre dû = 4 (quota) − 2 (crédit) = 2")
}

console.log('\nTest 13 — cas réel : Cardinal Asphalte (rien livré en octobre → nov. dû = 8)')
{
  // Tout son historique (juillet à septembre, 16 pièces) est AVANT le
  // départ d'octobre — entièrement ignoré. Rien de livré en octobre
  // lui-même (seulement 2 idées, non livrées) → retard plein de 4.
  const delivered = [
    ...Array(7).fill(m('2026-07')), ...Array(4).fill(m('2026-08')), ...Array(5).fill(m('2026-09')),
    ...Array(3).fill(m('2026-11')), // delivered en novembre lui-même (statut filme/publie)
  ]
  const oct = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-10'), deliveredMonths: delivered })
  assertEqual(oct.delivered, 0, 'Cardinal Asphalte : rien livré en octobre (tout l\'historique antérieur est ignoré)')
  assertEqual(oct.late, 4, 'Cardinal Asphalte : retard plein de 4 entrant en novembre')
  const nov = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), deliveredMonths: delivered })
  assertEqual(nov.due, 8, 'Cardinal Asphalte : novembre dû = 4 (retard) + 4 (quota) = 8')
  assertEqual(nov.delivered, 3, 'Cardinal Asphalte : 3 déjà livrées en novembre (progression affichée 3/8)')
}

console.log('\nTest 14 — cas réel : Nor-Can (à jour → nov. dû = 4)')
{
  // Juillet et août (9 pièces) sont avant le départ d'octobre — ignorés.
  const delivered = [...Array(4).fill(m('2026-07')), ...Array(5).fill(m('2026-08')), ...Array(4).fill(m('2026-10'))]
  const oct = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-10'), deliveredMonths: delivered })
  assertEqual(oct.late, 0, 'Nor-Can : aucun retard entrant en novembre')
  const nov = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), deliveredMonths: delivered })
  assertEqual(nov.due, 4, 'Nor-Can : novembre dû = 4')
}

console.log('\nTest 15 — cas réel : Raf & Steve Maher (à jour → nov. dû = 4)')
{
  // Tout son historique (juillet à septembre, très volumineux) est avant le
  // départ d'octobre — ignoré. 4 livrées en octobre, 1 "filme" en novembre.
  const delivered = [...Array(26).fill(m('2026-09')), ...Array(4).fill(m('2026-10')), ...Array(1).fill(m('2026-11'))]
  const oct = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-10'), deliveredMonths: delivered })
  assertEqual(oct.late, 0, 'Maher : aucun retard entrant en novembre (le volume de septembre est ignoré)')
  const nov = computeDeliverableTypeState({ perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), deliveredMonths: delivered })
  assertEqual(nov.due, 4, 'Maher : novembre dû = 4')
  assertEqual(nov.delivered, 1, 'Maher : 1 déjà livrée en novembre (progression affichée 1/4)')
}

console.log(failures === 0 ? '\n✅ Tous les tests passent.' : `\n❌ ${failures} test(s) en échec.`)
process.exitCode = failures === 0 ? 0 : 1
