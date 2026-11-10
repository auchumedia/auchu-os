import { qboEnvironment, type QuickBooksEnvironment } from './config'

// ══════════════════════════════════════════════════════════════════════════════
// Document de découverte OpenID Connect d'Intuit — SEULE source des endpoints
// OAuth (autorisation, jetons, révocation). Jamais hardcodés ailleurs dans le
// code : src/app/api/quickbooks/connect|callback/route.ts et
// src/lib/quickbooks/oauth.ts passent TOUJOURS par getDiscoveryDocument().
//
// Deux documents distincts chez Intuit, un par environnement :
//   production : https://developer.api.intuit.com/.well-known/openid_configuration
//   sandbox    : https://developer.api.intuit.com/.well-known/openid_sandbox_configuration
// (La base de l'API Accounting, elle, n'est PAS dans ce document — voir
// qboApiBaseUrl() dans config.ts, convention séparée propre à Intuit.)
// ══════════════════════════════════════════════════════════════════════════════

export interface QuickBooksDiscoveryDocument {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  revocation_endpoint: string
  userinfo_endpoint?: string
  jwks_uri?: string
}

const DISCOVERY_URLS: Record<QuickBooksEnvironment, string> = {
  production: 'https://developer.api.intuit.com/.well-known/openid_configuration',
  sandbox:    'https://developer.api.intuit.com/.well-known/openid_sandbox_configuration',
}

// Cache mémoire (par instance de fonction serverless — repeuplé au cold
// start, ce qui reste largement suffisant : ce document ne change presque
// jamais). TTL généreux pour éviter un aller-retour réseau à chaque requête.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12h
const cache = new Map<QuickBooksEnvironment, { doc: QuickBooksDiscoveryDocument; fetchedAt: number }>()

export async function getDiscoveryDocument(env: QuickBooksEnvironment = qboEnvironment()): Promise<QuickBooksDiscoveryDocument> {
  const cached = cache.get(env)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.doc
  }

  const res = await fetch(DISCOVERY_URLS[env], { cache: 'no-store' })
  if (!res.ok) {
    // Si on a un cache périmé mais utilisable en dépannage, mieux vaut s'en
    // servir qu'échouer complètement sur un endpoint de découverte en panne.
    if (cached) return cached.doc
    throw new Error(`Impossible de récupérer le document de découverte QuickBooks (${env}) — HTTP ${res.status}`)
  }

  const doc = await res.json() as QuickBooksDiscoveryDocument
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.revocation_endpoint) {
    throw new Error(`Document de découverte QuickBooks (${env}) incomplet`)
  }

  cache.set(env, { doc, fetchedAt: Date.now() })
  return doc
}
