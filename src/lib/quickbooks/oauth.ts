import { randomBytes } from 'crypto'
import { getDiscoveryDocument } from './discovery'
import { qboClientId, qboClientSecret, qboRedirectUri, qboEnvironment, QUICKBOOKS_SCOPE } from './config'

function basicAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${qboClientId()}:${qboClientSecret()}`).toString('base64')
}

export function generateState(): string {
  return randomBytes(24).toString('base64url')
}

// URL d'autorisation Intuit — authorization_endpoint vient TOUJOURS du
// document de découverte (discovery.ts), jamais une URL en dur ici.
export async function buildAuthorizationUrl(state: string): Promise<string> {
  const discovery = await getDiscoveryDocument()
  const url = new URL(discovery.authorization_endpoint)
  url.searchParams.set('client_id', qboClientId())
  url.searchParams.set('redirect_uri', qboRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', QUICKBOOKS_SCOPE)
  url.searchParams.set('state', state)
  return url.toString()
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number               // secondes — durée de vie de l'access_token
  x_refresh_token_expires_in: number // secondes — durée de vie du refresh_token
}

export interface ExchangedTokens {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
}

function fromTokenResponse(json: TokenResponse): ExchangedTokens {
  const now = Date.now()
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    accessTokenExpiresAt: new Date(now + json.expires_in * 1000),
    refreshTokenExpiresAt: new Date(now + json.x_refresh_token_expires_in * 1000),
  }
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const discovery = await getDiscoveryDocument()
  const res = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
    cache: 'no-store',
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    // invalid_grant = refresh token expiré/révoqué/déjà utilisé — le code
    // appelant (client.ts) transforme ça en QuickBooksReconnectRequiredError.
    const code = json?.error || `http_${res.status}`
    throw new Error(code)
  }

  return json as TokenResponse
}

export async function exchangeCodeForTokens(code: string): Promise<ExchangedTokens> {
  const json = await postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: qboRedirectUri(),
  })
  return fromTokenResponse(json)
}

// Intuit fait TOUJOURS tourner le refresh_token à chaque appel — le nouveau
// doit systématiquement remplacer l'ancien (cf. connection.ts saveTokens,
// jamais de "si différent").
export async function refreshTokens(refreshToken: string): Promise<ExchangedTokens> {
  const json = await postToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  return fromTokenResponse(json)
}

// revocation_endpoint vient aussi du document de découverte.
export async function revokeToken(refreshToken: string): Promise<void> {
  const discovery = await getDiscoveryDocument()
  const res = await fetch(discovery.revocation_endpoint, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: refreshToken }),
    cache: 'no-store',
  })

  // 200 = révoqué. Un jeton déjà invalide/expiré renvoie une erreur côté
  // Intuit — sans conséquence puisqu'on nettoie notre état localement dans
  // tous les cas (cf. api/quickbooks/disconnect/route.ts).
  if (!res.ok && res.status !== 400) {
    throw new Error(`Révocation QuickBooks échouée — HTTP ${res.status}`)
  }
}

export function currentEnvironment() {
  return qboEnvironment()
}
