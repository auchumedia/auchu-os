// Jeté quand le refresh token QuickBooks est expiré/révoqué (invalid_grant)
// ou qu'aucune connexion n'existe — le code appelant doit marquer la
// connexion "reconnect_required" et laisser l'UI afficher le bouton
// "Reconnecter", jamais planter la page.
export class QuickBooksReconnectRequiredError extends Error {
  constructor(message = 'QuickBooks doit être reconnecté') {
    super(message)
    this.name = 'QuickBooksReconnectRequiredError'
  }
}

export class QuickBooksNotConnectedError extends Error {
  constructor(message = 'QuickBooks n\'est pas connecté') {
    super(message)
    this.name = 'QuickBooksNotConnectedError'
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Erreurs d'API QuickBooks (ni jeton expiré ni déconnexion) — requête
// invalide (erreur de syntaxe), ressource non disponible pour le forfait de
// l'entreprise, Id inexistant, etc. Jamais bloquantes pour le reste d'une
// synchro (cf. sync.ts, qui capture ressource par ressource) ; toujours
// journalisées avec l'intuit_tid pour le support Intuit (section "Error
// Handling" du questionnaire de conformité).
//
// Fichier volontairement sans dépendance (pas d'import depuis ce dossier ni
// depuis @/lib) — utilisable isolément, y compris par
// scripts/test-quickbooks-error-handling.mts (test local simulé, sans
// identifiants Intuit).
// ══════════════════════════════════════════════════════════════════════════════

export interface QuickBooksApiErrorInfo {
  endpoint: string
  status: number
  intuitCode?: string | null
  intuitTid?: string | null
  message: string
}

export class QuickBooksApiError extends Error {
  endpoint: string
  status: number
  intuitCode: string | null
  intuitTid: string | null

  constructor(info: QuickBooksApiErrorInfo) {
    super(info.message)
    this.name = 'QuickBooksApiError'
    this.endpoint = info.endpoint
    this.status = info.status
    this.intuitCode = info.intuitCode ?? null
    this.intuitTid = info.intuitTid ?? null
  }
}

// Lit l'en-tête "intuit_tid" et le corps Fault.Error[0] (code/Message) de la
// RÉPONSE QuickBooks — jamais la requête (jamais l'en-tête Authorization,
// jamais le jeton). Ne lance jamais d'exception : un corps non-JSON ou
// inattendu retombe simplement sur un message générique "HTTP {status}",
// pour que l'appelant (qboFetch) ne plante jamais sur une réponse
// imprévisible d'Intuit.
export async function parseQuickBooksApiError(endpoint: string, res: Response): Promise<QuickBooksApiError> {
  const intuitTid = res.headers.get('intuit_tid')
  let intuitCode: string | undefined
  let intuitMessage: string | undefined

  try {
    const body: { Fault?: { Error?: { code?: string; Message?: string }[] } } = await res.json()
    const fault = body?.Fault?.Error?.[0]
    intuitCode = fault?.code
    intuitMessage = fault?.Message
  } catch {
    // Corps non-JSON/vide (HTML d'erreur générique, timeout, etc.) — on
    // garde quand même le status et l'intuit_tid ci-dessous.
  }

  return new QuickBooksApiError({
    endpoint,
    status: res.status,
    intuitCode,
    intuitTid,
    message: intuitMessage || `HTTP ${res.status}`,
  })
}

// Journal structuré — endpoint, statut HTTP, code d'erreur Intuit,
// intuit_tid, horodatage. JAMAIS de jeton, secret, clé de chiffrement,
// montant ni nom de client : ces champs ne font partie d'aucune des
// structures ci-dessus, donc ne peuvent pas s'y retrouver par erreur.
export function logQuickBooksApiError(error: QuickBooksApiError) {
  console.error('[quickbooks/api]', JSON.stringify({
    endpoint: error.endpoint,
    status: error.status,
    intuitCode: error.intuitCode,
    intuitTid: error.intuitTid,
    timestamp: new Date().toISOString(),
    message: error.message,
  }))
}
