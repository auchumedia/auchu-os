import { getConnection, saveTokens, markReconnectRequired } from './connection'
import { refreshTokens } from './oauth'
import { qboApiBaseUrl, qboEnvironment } from './config'
import { QuickBooksReconnectRequiredError, QuickBooksNotConnectedError } from './errors'

// Marge de sécurité avant l'expiration réelle de l'access_token — on
// rafraîchit PENDANT cette fenêtre, jamais après coup.
const REFRESH_MARGIN_MS = 5 * 60 * 1000

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function forceRefresh(ownerId: string, refreshToken: string, realmId: string, companyName: string | null): Promise<string> {
  let fresh
  try {
    fresh = await refreshTokens(refreshToken)
  } catch (e) {
    // invalid_grant (ou toute autre erreur token_endpoint) = refresh token
    // mort — connexion marquée à reconnecter, jamais de boucle de retry ici.
    // Jamais le message brut ni le jeton dans ce log, seulement le code
    // d'erreur Intuit (ex: "invalid_grant").
    await markReconnectRequired(ownerId, e instanceof Error ? e.message : 'refresh_failed')
    throw new QuickBooksReconnectRequiredError()
  }

  // Le nouveau refresh_token (toujours renvoyé par Intuit, et toujours
  // différent de l'ancien) est systématiquement réécrit ici.
  await saveTokens(ownerId, {
    accessToken: fresh.accessToken,
    refreshToken: fresh.refreshToken,
    accessTokenExpiresAt: fresh.accessTokenExpiresAt,
    refreshTokenExpiresAt: fresh.refreshTokenExpiresAt,
    realmId,
    environment: qboEnvironment(),
    companyName,
  })

  return fresh.accessToken
}

// Jeton d'accès valide pour `ownerId`, rafraîchi à l'avance (marge de 5 min)
// si besoin. Ne lance jamais d'erreur "brute" de l'API Intuit — seulement
// QuickBooksNotConnectedError / QuickBooksReconnectRequiredError, que les
// appelants (routes API, UI) savent gérer sans planter.
export async function ensureFreshAccessToken(ownerId: string): Promise<{ accessToken: string; realmId: string; companyName: string | null }> {
  const connection = await getConnection(ownerId)
  if (!connection) throw new QuickBooksNotConnectedError()
  if (connection.status === 'disconnected') throw new QuickBooksNotConnectedError()
  if (connection.status === 'reconnect_required' || !connection.refreshToken) {
    throw new QuickBooksReconnectRequiredError()
  }

  const expiresAt = connection.accessTokenExpiresAt ? new Date(connection.accessTokenExpiresAt).getTime() : 0
  const needsRefresh = !connection.accessToken || expiresAt - Date.now() < REFRESH_MARGIN_MS

  if (!needsRefresh) {
    return { accessToken: connection.accessToken!, realmId: connection.realmId, companyName: connection.companyName }
  }

  const accessToken = await forceRefresh(ownerId, connection.refreshToken, connection.realmId, connection.companyName)
  return { accessToken, realmId: connection.realmId, companyName: connection.companyName }
}

async function requestOnce(url: string, accessToken: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  })
}

// Wrapper générique pour tout appel à l'API Accounting QuickBooks (lecture
// seule — company/*, query/* en GET uniquement, jamais de POST/PUT qui
// modifierait des données chez Intuit) :
//   - 401 → un seul rafraîchissement forcé + un seul nouvel essai
//   - 429 / 5xx → attente progressive, 3 essais au maximum au total
export async function qboFetch<T = unknown>(ownerId: string, path: string, init: RequestInit = {}): Promise<T> {
  const { accessToken, realmId, companyName } = await ensureFreshAccessToken(ownerId)
  const url = `${qboApiBaseUrl()}/v3/company/${realmId}${path}`

  let token = accessToken
  let res = await requestOnce(url, token, init)

  if (res.status === 401) {
    const connection = await getConnection(ownerId)
    if (!connection?.refreshToken) throw new QuickBooksReconnectRequiredError()
    token = await forceRefresh(ownerId, connection.refreshToken, realmId, companyName)
    res = await requestOnce(url, token, init)
    if (res.status === 401) {
      await markReconnectRequired(ownerId, 'HTTP 401 persistant après rafraîchissement du jeton')
      throw new QuickBooksReconnectRequiredError()
    }
  }

  let attempt = 1
  while ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await sleep(2 ** attempt * 500) // 1s puis 2s
    res = await requestOnce(url, token, init)
    attempt++
  }

  if (!res.ok) {
    throw new Error(`Appel QuickBooks ${path} a échoué après retries — HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

// Appel minimal de connectivité — confirme que le jeton fonctionne et
// récupère le nom de l'entreprise affiché dans la section Finances.
export async function fetchCompanyInfo(ownerId: string) {
  const { realmId } = await ensureFreshAccessToken(ownerId)
  const data = await qboFetch<{ CompanyInfo: { CompanyName: string } }>(ownerId, `/companyinfo/${realmId}`)
  return data.CompanyInfo?.CompanyName ?? null
}
