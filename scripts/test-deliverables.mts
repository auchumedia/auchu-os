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

console.log("Test 1 — règle 1 : le quota du mois EN COURS n'est jamais du retard")
{
  // Novembre est le mois en cours (currentMonth = targetMonth = novembre) :
  // même avec 0 livré et aucun retard reporté, le quota de novembre lui-même
  // n'est pas "en retard" — juste "à faire".
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-11'),
    deliveredMonths: Array(4).fill(m('2026-10')), // octobre à l'équilibre, aucun backlog
  })
  assertEqual(r.due, 4, 'novembre : à livrer = 4 (quota seul, aucun backlog)')
  assertEqual(r.delivered, 0, "novembre : rien livré jusqu'ici")
  assertEqual(r.late, 0, "novembre : AUCUN retard malgré 0 livré — le mois n'est pas terminé")
}

console.log('Test 2 — le même mois, une fois terminé, devient pleinement du retard')
{
  // Même situation, mais on regarde novembre depuis décembre (novembre est
  // maintenant un mois entièrement passé) : le quota non livré compte.
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-12'),
    deliveredMonths: Array(4).fill(m('2026-10')),
  })
  assertEqual(r.due, 4, 'novembre (vu depuis décembre) : à livrer = 4')
  assertEqual(r.delivered, 0, 'novembre : toujours rien livré')
  assertEqual(r.late, 4, 'novembre terminé sans rien livré : retard = à livrer − livré = 4')
}

console.log('Test 3 — retard reporté : le badge ne compte que le backlog, pas le quota du mois')
{
  // Octobre (terminé, 4 livrées sur 6 dues) laisse un backlog de 2 entrant
  // en novembre (en cours). Rien livré en novembre jusqu'ici.
  const delivered = Array(4).fill(m('2026-10'))
  const r = computeDeliverableTypeState({
    perMonth: 6, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-11'), deliveredMonths: delivered,
  })
  assertEqual(r.due, 8, "novembre : à livrer = 6 (quota) + 2 (backlog d'octobre) = 8")
  assertEqual(r.delivered, 0, "novembre : rien livré jusqu'ici")
  assertEqual(r.late, 2, "novembre : badge = backlog (2) − livré ce mois (0) = 2 (le quota de novembre n'y entre pas)")
}

console.log("Test 4 — crédit reporté : gonfle le livré affiché, n'enfle jamais le due, annule le badge")
{
  // Octobre (terminé, 8 livrées sur 6 dues) laisse un crédit de 2.
  const delivered = Array(8).fill(m('2026-10'))
  const r = computeDeliverableTypeState({
    perMonth: 6, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-11'), deliveredMonths: delivered,
  })
  assertEqual(r.due, 6, 'novembre : à livrer = 6 (quota seul — le crédit ne réduit jamais le due)')
  assertEqual(r.delivered, 2, "novembre : livré affiché = 0 (rien livré ce mois) + 2 (crédit) = 2")
  assertEqual(r.late, 0, 'novembre : aucun retard — le backlog est 0 (crédit, pas retard)')
}

console.log('Test 5 — même un crédit énorme ne fait jamais descendre le due sous le quota')
{
  const delivered = Array(20).fill(m('2026-01')) // énorme avance en janvier, quota 2
  const r = computeDeliverableTypeState({
    perMonth: 2, startMonth: m('2026-01'), targetMonth: m('2026-02'), currentMonth: m('2026-02'), deliveredMonths: delivered,
  })
  assertEqual(r.due, 2, 'février : à livrer = 2 (quota seul, jamais réduit par le crédit)')
  assertEqual(r.delivered, 18, 'février : livré affiché = 0 + 18 (crédit : 2 dus en janvier − 20 livrés)')
  assertEqual(r.late, 0, 'février : aucun retard')
}

console.log("Test 6 — client démarré en cours d'année (aucun retard fictif avant le départ)")
{
  const start = m('2026-08')

  const june = computeDeliverableTypeState({ perMonth: 4, startMonth: start, targetMonth: m('2026-06'), currentMonth: m('2026-09'), deliveredMonths: [] })
  assertEqual(june.due, 0, 'juin (avant le départ en août) : rien dû')
  assertEqual(june.late, 0, 'juin : aucun retard avant le départ du client')

  const aug = computeDeliverableTypeState({ perMonth: 4, startMonth: start, targetMonth: m('2026-08'), currentMonth: m('2026-09'), deliveredMonths: [] })
  assertEqual(aug.due, 4, "août (mois de départ, déjà terminé) : dû = quota seul, pas de retard reporté")
  assertEqual(aug.late, 4, 'août (terminé, rien livré) : retard = 4')

  const sep = computeDeliverableTypeState({ perMonth: 4, startMonth: start, targetMonth: m('2026-09'), currentMonth: m('2026-09'), deliveredMonths: [] })
  assertEqual(sep.due, 8, "septembre (en cours) : 4 (quota) + 4 (backlog reporté d'août) = 8")
  assertEqual(sep.late, 4, "septembre (en cours) : badge = backlog (4) — le quota de septembre n'y entre pas")
}

console.log('Test 7 — mois sans livrable (quota = 0 → jamais rien dû)')
{
  const start = m('2026-01')
  const noQuota = computeDeliverableTypeState({ perMonth: 0, startMonth: start, targetMonth: m('2026-06'), currentMonth: m('2026-06'), deliveredMonths: [] })
  assertEqual(noQuota.due, 0, 'quota 0 : rien dû, quel que soit le mois')
  assertEqual(noQuota.late, 0, 'quota 0 : jamais de retard')
}

console.log('Test 8 — short_form et long_form calculés séparément (computeClientDeliverables)')
{
  const result = computeClientDeliverables({
    deliverablesShortForm: 6,
    deliverablesLongForm: 2,
    startMonth: m('2026-01'),
    targetMonth: m('2026-02'),
    currentMonth: m('2026-02'),
    deliveredShortFormMonths: [m('2026-01'), m('2026-01'), m('2026-01'), m('2026-01')], // 4/6 en janvier → backlog 2
    deliveredLongFormMonths: [m('2026-01'), m('2026-01'), m('2026-01')],                 // 3/2 en janvier → crédit 1
  })
  assertEqual(result.shortForm.due, 8, "short_form février : à livrer = 6 (quota) + 2 (backlog) = 8")
  assertEqual(result.shortForm.late, 2, 'short_form février : badge = backlog 2 (rien livré en février)')
  assertEqual(result.longForm.due, 2, "long_form février : à livrer = 2 (quota seul)")
  assertEqual(result.longForm.delivered, 1, 'long_form février : livré affiché = 0 + 1 (crédit)')
  assertEqual(result.longForm.late, 0, "long_form février : aucun retard (crédit, pas backlog)")
  assertEqual(result.totalDue, 10, 'total février : 8 (short) + 2 (long) = 10')
  assertEqual(result.totalLate, 2, 'total février : 2 (short) + 0 (long) = 2')
}

console.log('Test 9 — helpers MonthKey (mois écoulés, addMonths)')
{
  assertEqual(monthsBetweenInclusive(m('2026-01'), m('2026-01')), 1, 'janvier→janvier = 1 mois')
  assertEqual(monthsBetweenInclusive(m('2026-01'), m('2026-03')), 3, 'janvier→mars = 3 mois')
  assertEqual(monthsBetweenInclusive(m('2026-03'), m('2026-01')), -1, 'mars→janvier = -1 (avant le départ)')
  assertEqual(JSON.stringify(addMonths(m('2026-12'), 1)), JSON.stringify(m('2027-01')), 'addMonths gère le changement d\'année')
  assertEqual(JSON.stringify(addMonths(m('2026-01'), -1)), JSON.stringify(m('2025-12')), 'addMonths négatif gère le changement d\'année')
}

console.log('\nTest 10 — ajustement manuel (+2 appliqué au backlog, sur un solde déjà à zéro)')
{
  // Octobre à l'équilibre (4 dus, 4 livrées) ; l'ajustement +2 doit se
  // répercuter intégralement sur le backlog de novembre.
  const delivered = Array(4).fill(m('2026-10'))
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-11'),
    deliveredMonths: delivered, manualAdjustment: 2,
  })
  assertEqual(r.due, 6, 'novembre : à livrer = 4 (quota) + 2 (ajustement manuel sur le backlog) = 6')
  assertEqual(r.late, 2, 'novembre : badge = 2 (ajustement, rien livré ce mois)')
  assertEqual(r.manualAdjustment, 2, "l'ajustement est répété dans le résultat pour l'affichage")
}

console.log('\nTest 11 — contenu livré AVANT le départ : ignoré (ni dû, ni livré, ni crédit)')
{
  const beforeStart = Array(5).fill(m('2026-09'))
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-10'), currentMonth: m('2026-11'), deliveredMonths: beforeStart,
  })
  assertEqual(r.delivered, 0, "septembre (avant le départ) n'est jamais compté comme livré en octobre")
  assertEqual(r.late, 4, 'octobre (terminé, rien livré en octobre lui-même) : retard = 4 (pas de crédit des 5 de septembre)')

  const mixed = [...Array(5).fill(m('2026-09')), ...Array(2).fill(m('2026-10'))]
  const mixedResult = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-10'), currentMonth: m('2026-11'), deliveredMonths: mixed,
  })
  assertEqual(mixedResult.delivered, 2, 'octobre : seuls les 2 livrés en octobre comptent (les 5 de septembre sont ignorés)')
  assertEqual(mixedResult.late, 2, 'octobre (terminé) : retard = 4 (dû) − 2 (livré compté) = 2')
}

// ── Cas réels novembre 2026 : tous les contacts repartent à zéro au 1er
// octobre 2026 (migration 053). currentMonth = novembre 2026 (mois réel
// "aujourd'hui"), targetMonth = novembre 2026 (mois affiché par défaut).
// Tout contenu antérieur à octobre est ignoré (Test 11), inclus ici pour
// prouver que le calcul ne s'en sert pas.

console.log('\nTest 12 — cas réel : Bâton Rouge Vaudreuil (à jour → 0/4, aucun badge)')
{
  const delivered = [...Array(4).fill(m('2026-09')), ...Array(4).fill(m('2026-10'))]
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-11'), deliveredMonths: delivered,
  })
  assertEqual(r.due, 4, 'Bâton Rouge : novembre à livrer = 4')
  assertEqual(r.delivered, 0, 'Bâton Rouge : 0 livré jusqu\'ici')
  assertEqual(r.late, 0, 'Bâton Rouge : aucun badge de retard')
}

console.log('\nTest 13 — cas réel : Groupe DDC (à jour → 0/4, aucun badge)')
{
  const delivered = Array(4).fill(m('2026-10'))
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-11'), deliveredMonths: delivered,
  })
  assertEqual(r.due, 4, 'Groupe DDC : novembre à livrer = 4')
  assertEqual(r.late, 0, 'Groupe DDC : aucun badge de retard')
}

console.log('\nTest 14 — cas réel : Équipe Lemire Filion (2 vidéos d\'avance → 2/4, aucun retard)')
{
  const delivered = Array(6).fill(m('2026-10'))
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-11'), deliveredMonths: delivered,
  })
  assertEqual(r.due, 4, 'Lemire Filion : novembre à livrer = 4 (quota seul)')
  assertEqual(r.delivered, 2, 'Lemire Filion : livré affiché = 0 + 2 (crédit) = 2 → affichage 2/4')
  assertEqual(r.late, 0, "Lemire Filion : aucun badge — c'est un crédit, pas un backlog")
}

console.log('\nTest 15 — cas réel : Cardinal Asphalte (état actuel des données → 3/8, 1 en retard)')
{
  // Rien livré en octobre (2 idées seulement, non tournées). En novembre :
  // "Terrain de basket 2" (publie), "Patinoire bleu blanc rouge" (filme),
  // "Vidéo cinématique Patinoire Bleu, blanc, rouge" (filme) → 3 livrées.
  const delivered = Array(3).fill(m('2026-11'))
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-11'), deliveredMonths: delivered,
  })
  assertEqual(r.due, 8, 'Cardinal Asphalte : à livrer = 4 (quota) + 4 (backlog plein d\'octobre, rien livré) = 8')
  assertEqual(r.delivered, 3, 'Cardinal Asphalte : 3 livrées en novembre → affichage 3/8')
  assertEqual(r.late, 1, 'Cardinal Asphalte : badge = backlog (4) − livré ce mois (3) = 1')
}

console.log('\nTest 16 — cas réel : Cardinal Asphalte avec l\'ajustement manuel +1 proposé → 3/9, 2 en retard')
{
  // Ajustement proposé pour refléter "5 en retard à l'entrée de novembre"
  // (voir rapport — nécessite aussi de confirmer si "Terrain de basket 2"
  // doit vraiment compter comme livré en novembre pour retomber à 2/9+3).
  const delivered = Array(3).fill(m('2026-11'))
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-11'),
    deliveredMonths: delivered, manualAdjustment: 1,
  })
  assertEqual(r.due, 9, 'Cardinal Asphalte (+1) : à livrer = 4 (quota) + 5 (backlog ajusté) = 9')
  assertEqual(r.delivered, 3, 'Cardinal Asphalte (+1) : toujours 3 livrées en novembre avec les données actuelles')
  assertEqual(r.late, 2, 'Cardinal Asphalte (+1) : badge = 5 (backlog) − 3 (livré) = 2')
}

console.log('\nTest 17 — cas réel : Nor-Can (à jour → 0/4, aucun badge)')
{
  const delivered = [...Array(4).fill(m('2026-07')), ...Array(5).fill(m('2026-08')), ...Array(4).fill(m('2026-10'))]
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-11'), deliveredMonths: delivered,
  })
  assertEqual(r.due, 4, 'Nor-Can : novembre à livrer = 4')
  assertEqual(r.late, 0, 'Nor-Can : aucun badge de retard')
}

console.log('\nTest 18 — cas réel : Raf & Steve Maher (laissé tel quel → 1/4, aucun retard)')
{
  const delivered = [...Array(26).fill(m('2026-09')), ...Array(4).fill(m('2026-10')), ...Array(1).fill(m('2026-11'))]
  const r = computeDeliverableTypeState({
    perMonth: 4, startMonth: m('2026-10'), targetMonth: m('2026-11'), currentMonth: m('2026-11'), deliveredMonths: delivered,
  })
  assertEqual(r.due, 4, 'Maher : novembre à livrer = 4')
  assertEqual(r.delivered, 1, 'Maher : 1 déjà livrée en novembre → affichage 1/4')
  assertEqual(r.late, 0, 'Maher : aucun badge de retard')
}

console.log(failures === 0 ? '\n✅ Tous les tests passent.' : `\n❌ ${failures} test(s) en échec.`)
process.exitCode = failures === 0 ? 0 : 1
