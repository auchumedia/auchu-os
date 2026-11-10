// Config QuickBooks — tout vient de l'environnement, rien en dur. Les
// endpoints OAuth (autorisation, jetons, révocation) ne sont PAS ici : ils
// sont lus depuis le document de découverte Intuit (discovery.ts) à chaque
// utilisation (avec cache), jamais codés en dur.

export type QuickBooksEnvironment = 'sandbox' | 'production'

export function qboEnvironment(): QuickBooksEnvironment {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
}

export function qboClientId(): string {
  const v = process.env.QUICKBOOKS_CLIENT_ID
  if (!v) throw new Error('QUICKBOOKS_CLIENT_ID manquant')
  return v
}

export function qboClientSecret(): string {
  const v = process.env.QUICKBOOKS_CLIENT_SECRET
  if (!v) throw new Error('QUICKBOOKS_CLIENT_SECRET manquant')
  return v
}

// redirect_uri doit correspondre EXACTEMENT à celui enregistré dans l'app
// Intuit (developer.intuit.com). QUICKBOOKS_REDIRECT_URI permet de le
// surcharger ; par défaut dérivé de NEXT_PUBLIC_APP_URL.
export function qboRedirectUri(): string {
  if (process.env.QUICKBOOKS_REDIRECT_URI) return process.env.QUICKBOOKS_REDIRECT_URI
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/quickbooks/callback`
}

// Scope minimal pour lire factures/achats/dépenses (lecture seule — aucune
// écriture n'est jamais faite dans QuickBooks, cf. src/lib/quickbooks/client.ts).
export const QUICKBOOKS_SCOPE = 'com.intuit.quickbooks.accounting'

// Nom + durée de vie du cookie CSRF — httpOnly, posé par
// /api/quickbooks/connect et vérifié par /api/quickbooks/callback.
export const QUICKBOOKS_STATE_COOKIE = 'qbo_oauth_state'
export const QUICKBOOKS_STATE_COOKIE_MAX_AGE = 10 * 60 // 10 minutes

// Base de l'API comptable Accounting — PAS une donnée OIDC (n'est pas dans le
// document de découverte), convention d'hébergement propre à Intuit selon
// l'environnement.
export function qboApiBaseUrl(): string {
  return qboEnvironment() === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}
