// ══════════════════════════════════════════════════════════════════════════════
// Test local de src/lib/insights.ts (fonctions pures — pas de réseau,
// pas de base de données). Lancer : node scripts/test-insights.mts
// (ou npm run test:insights)
// ══════════════════════════════════════════════════════════════════════════════

import {
  percentVariation, totalInteractions, engagementRate, sumAcrossPlatforms,
  type InsightMetrics,
} from '../src/lib/insights.ts'

let failures = 0

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`)
  } else {
    console.log(`  ✗ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`)
    failures++
  }
}

function metrics(partial: Partial<InsightMetrics>): InsightMetrics {
  return {
    followers: null, followers_gained: null, views: null, reach: null,
    likes: null, comments: null, shares: null, saves: null,
    profile_visits: null, posts_published: null,
    ...partial,
  }
}

console.log('Test 1 — percentVariation : cas normal (hausse et baisse)')
{
  assertEqual(percentVariation(120, 100), 20, '120 vs 100 = +20%')
  assertEqual(percentVariation(80, 100), -20, '80 vs 100 = -20%')
  assertEqual(percentVariation(100, 100), 0, '100 vs 100 = 0%')
}

console.log('\nTest 2 — percentVariation : valeurs manquantes → null ("—" côté UI)')
{
  assertEqual(percentVariation(null, 100), null, 'current manquant → null')
  assertEqual(percentVariation(100, null), null, 'previous manquant → null')
  assertEqual(percentVariation(undefined, undefined), null, 'les deux manquants → null')
}

console.log('\nTest 3 — percentVariation : division par zéro évitée')
{
  assertEqual(percentVariation(50, 0), null, 'previous = 0 → null, jamais Infinity')
  assertEqual(percentVariation(0, 0), null, '0 vs 0 → null (pas 0% trompeur)')
  assertEqual(percentVariation(0, 100), -100, '0 vs 100 = -100% (ça reste un vrai calcul)')
}

console.log("\nTest 4 — totalInteractions : somme des 4 champs, partiels autorisés")
{
  assertEqual(totalInteractions(metrics({ likes: 10, comments: 5, shares: 2, saves: 3 })), 20, 'les 4 renseignés → somme')
  assertEqual(totalInteractions(metrics({ likes: 10 })), 10, 'seul "likes" renseigné → total partiel = 10, pas null')
  assertEqual(totalInteractions(metrics({})), null, 'aucun des 4 renseigné → indéterminé (null), pas 0')
}

console.log('\nTest 5 — engagementRate : interactions ÷ abonnés × 100')
{
  assertEqual(engagementRate(metrics({ likes: 40, comments: 10, followers: 1000 })), 5, '50 interactions / 1000 abonnés = 5%')
  assertEqual(engagementRate(metrics({ likes: 10, followers: null })), null, 'abonnés manquants → null')
  assertEqual(engagementRate(metrics({ likes: 10, followers: 0 })), null, 'abonnés = 0 → null, jamais Infinity')
  assertEqual(engagementRate(metrics({ followers: 1000 })), null, 'aucune interaction renseignée → null (pas 0%)')
}

console.log('\nTest 6 — sumAcrossPlatforms : vue "Toutes les plateformes"')
{
  const rows = [
    metrics({ views: 1000, likes: 50, comments: 10 }), // instagram
    metrics({ views: 500,  likes: 20 }),                // facebook
    metrics({}),                                        // tiktok — rien saisi ce mois
  ]
  const sum = sumAcrossPlatforms(rows)
  assertEqual(sum.views, 1500, 'vues : 1000 + 500 (tiktok ignoré car null) = 1500')
  assertEqual(sum.interactions, 80, 'interactions : (50+10) + 20 + 0 (tiktok indéterminé) = 80')
}

console.log("\nTest 7 — sumAcrossPlatforms : aucune plateforme saisie → tout null (pas 0)")
{
  const sum = sumAcrossPlatforms([metrics({}), metrics({}), metrics({})])
  assertEqual(sum.views, null, 'aucune vue saisie nulle part → null')
  assertEqual(sum.interactions, null, 'aucune interaction saisie nulle part → null')
}

console.log(failures === 0 ? '\n✅ Tous les tests passent.' : `\n❌ ${failures} test(s) en échec.`)
process.exitCode = failures === 0 ? 0 : 1
