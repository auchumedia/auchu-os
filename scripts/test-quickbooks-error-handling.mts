// ══════════════════════════════════════════════════════════════════════════════
// Test local simulé — section "Error Handling" du questionnaire de
// conformité Intuit.
//
// Aucun identifiant QuickBooks n'est configuré pour ce projet (pas d'app
// developer.intuit.com encore créée) : ce script ne peut donc PAS taper le
// bac à sable Intuit réel. Il simule plutôt, sans réseau ni secret, les deux
// familles de réponses que l'API Accounting renvoie dans ces cas et vérifie
// le comportement exact de src/lib/quickbooks/errors.ts (le code qui
// traite réellement ces réponses dans qboFetch()) :
//
//   1) erreur de syntaxe (requête invalide — "Invalid Query")
//   2) erreur de validation (Id inexistant — "Object Not Found")
//   3) un corps de réponse non-JSON/imprévisible (ne doit jamais planter)
//   4) le journal structuré ne doit jamais contenir de jeton/secret
//
// Lancer : node scripts/test-quickbooks-error-handling.mts
// (Node 24 — type stripping natif, pas de dépendance ajoutée.)
// ══════════════════════════════════════════════════════════════════════════════

import { parseQuickBooksApiError, logQuickBooksApiError, QuickBooksApiError } from '../src/lib/quickbooks/errors.ts'

let failures = 0

function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✓ ${label}`)
  } else {
    console.log(`  ✗ ${label}`)
    failures++
  }
}

function fakeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

async function main() {
  console.log('Test 1 — erreur de syntaxe (requête invalide)')
  const syntaxRes = fakeResponse(400, {
    Fault: {
      Error: [{ Message: 'Invalid Query', Detail: 'QueryParserError: Encountered " " at line 1, column 23.', code: '4000' }],
      type: 'ValidationFault',
    },
  }, { intuit_tid: 'test-tid-syntax-001' })

  let syntaxError: QuickBooksApiError
  try {
    syntaxError = await parseQuickBooksApiError('/v3/company/123/query', syntaxRes)
  } catch (e) {
    assert(false, `parseQuickBooksApiError ne doit jamais lancer — a lancé: ${e}`)
    throw e
  }
  assert(syntaxError instanceof QuickBooksApiError, 'retourne une QuickBooksApiError (ne plante pas)')
  assert(syntaxError.status === 400, 'statut HTTP capturé (400)')
  assert(syntaxError.intuitCode === '4000', "code d'erreur Intuit capturé (4000)")
  assert(syntaxError.intuitTid === 'test-tid-syntax-001', 'intuit_tid capturé')
  assert(syntaxError.message === 'Invalid Query', 'message lisible capturé pour affichage')

  console.log('\nTest 2 — erreur de validation (Id inexistant)')
  const notFoundRes = fakeResponse(400, {
    Fault: {
      Error: [{ Message: 'Object Not Found', Detail: 'Something was not found during the operation.', code: '610' }],
      type: 'ValidationFault',
    },
  }, { intuit_tid: 'test-tid-notfound-002' })

  const notFoundError = await parseQuickBooksApiError('/v3/company/123/invoice/999999999', notFoundRes)
  assert(notFoundError.status === 400, 'statut HTTP capturé (400)')
  assert(notFoundError.intuitCode === '610', "code d'erreur Intuit capturé (610 = Object Not Found)")
  assert(notFoundError.intuitTid === 'test-tid-notfound-002', 'intuit_tid capturé')
  assert(notFoundError.message === 'Object Not Found', 'message lisible capturé')

  console.log('\nTest 3 — corps de réponse non-JSON (ne doit jamais planter)')
  const brokenRes = fakeResponse(503, '<html>Service Unavailable</html>', { intuit_tid: 'test-tid-broken-003', 'content-type': 'text/html' })
  const brokenError = await parseQuickBooksApiError('/v3/company/123/companyinfo/123', brokenRes)
  assert(brokenError.status === 503, 'statut HTTP capturé même sans corps JSON valide')
  assert(brokenError.intuitTid === 'test-tid-broken-003', 'intuit_tid capturé même sans corps JSON valide')
  assert(brokenError.message === 'HTTP 503', 'message de repli — aucun crash sur un corps JSON invalide')

  console.log('\nTest 4 — journal structuré : endpoint/statut/code/intuit_tid, jamais de donnée sensible')
  const capturedLogs: string[] = []
  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => { capturedLogs.push(args.map(a => String(a)).join(' ')) }
  try {
    logQuickBooksApiError(syntaxError)
  } finally {
    console.error = originalConsoleError
  }
  const logged = capturedLogs.join('\n')
  assert(logged.includes('"endpoint":"/v3/company/123/query"'), "le journal contient l'endpoint")
  assert(logged.includes('"status":400'), 'le journal contient le statut HTTP')
  assert(logged.includes('"intuitCode":"4000"'), "le journal contient le code d'erreur Intuit")
  assert(logged.includes('"intuitTid":"test-tid-syntax-001"'), 'le journal contient le intuit_tid (pour le support Intuit)')
  assert(/"timestamp":"\d{4}-\d{2}-\d{2}T/.test(logged), 'le journal contient un horodatage ISO')
  assert(
    !/bearer|access_token|refresh_token|client_secret|montant|amount["\s:]*\d/i.test(logged),
    'le journal ne contient jamais de jeton, secret, ou montant'
  )

  console.log(failures === 0 ? '\n✅ Tous les tests passent — aucun crash, intuit_tid capturé, aucune donnée sensible journalisée.' : `\n❌ ${failures} test(s) en échec.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch(e => {
  console.error('Le script de test a planté de façon inattendue —', e)
  process.exitCode = 1
})
