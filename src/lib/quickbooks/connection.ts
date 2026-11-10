import { createAdminClient } from '@/lib/supabase/admin'
import { encryptToken, decryptToken } from './crypto'
import type { QuickBooksEnvironment } from './config'

// quickbooks_connections n'a plus aucune policy RLS pour authenticated/anon
// depuis la migration 049 — tout accès passe par le client admin
// (service_role, server-only). Jamais de SupabaseClient passé en paramètre
// ici : ça empêcherait d'utiliser par erreur le client lié à la session de
// l'utilisateur, qui n'aurait plus aucun droit sur cette table de toute
// façon depuis la migration 049.

export type QuickBooksStatus = 'connected' | 'reconnect_required' | 'disconnected'
export type QuickBooksSyncStatus = 'success' | 'error' | 'reconnect_required'

export interface QuickBooksConnection {
  realmId: string
  environment: QuickBooksEnvironment
  accessToken: string | null
  refreshToken: string | null
  accessTokenExpiresAt: string | null
  refreshTokenExpiresAt: string | null
  status: QuickBooksStatus
  companyName: string | null
  lastError: string | null
  lastSyncAt: string | null
  lastSyncStatus: QuickBooksSyncStatus | null
}

type DbRow = {
  realm_id: string
  environment: string
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
  access_token_expires_at: string | null
  refresh_token_expires_at: string | null
  status: string
  company_name: string | null
  last_error: string | null
  last_sync_at: string | null
  last_sync_status: string | null
}

function fromRow(row: DbRow): QuickBooksConnection {
  return {
    realmId: row.realm_id,
    environment: row.environment as QuickBooksEnvironment,
    accessToken: row.access_token_encrypted ? decryptToken(row.access_token_encrypted) : null,
    refreshToken: row.refresh_token_encrypted ? decryptToken(row.refresh_token_encrypted) : null,
    accessTokenExpiresAt: row.access_token_expires_at,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
    status: row.status as QuickBooksStatus,
    companyName: row.company_name,
    lastError: row.last_error,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status as QuickBooksSyncStatus | null,
  }
}

// user_id = toujours ownerId (ctx.dataOwnerId), jamais l'id du membre qui
// clique "Connecter" — même convention que revenues/expenses (migration 047).
export async function getConnection(ownerId: string): Promise<QuickBooksConnection | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('quickbooks_connections')
    .select('realm_id, environment, access_token_encrypted, refresh_token_encrypted, access_token_expires_at, refresh_token_expires_at, status, company_name, last_error, last_sync_at, last_sync_status')
    .eq('user_id', ownerId)
    .maybeSingle()

  if (error) throw new Error(`[quickbooks] lecture connexion échouée — ${error.message}`)
  if (!data) return null
  return fromRow(data as DbRow)
}

export async function saveTokens(ownerId: string, params: {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
  realmId: string
  environment: QuickBooksEnvironment
  companyName?: string | null
}) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('quickbooks_connections')
    .upsert({
      user_id: ownerId,
      realm_id: params.realmId,
      environment: params.environment,
      access_token_encrypted: encryptToken(params.accessToken),
      // Intuit fait toujours tourner le refresh token à chaque rafraîchissement
      // — on écrit systématiquement le nouveau, jamais de "si différent".
      refresh_token_encrypted: encryptToken(params.refreshToken),
      access_token_expires_at: params.accessTokenExpiresAt.toISOString(),
      refresh_token_expires_at: params.refreshTokenExpiresAt.toISOString(),
      status: 'connected',
      company_name: params.companyName ?? null,
      last_error: null,
    }, { onConflict: 'user_id' })

  if (error) throw new Error(`[quickbooks] sauvegarde jetons échouée — ${error.message}`)
}

export async function markReconnectRequired(ownerId: string, reason: string) {
  const supabase = createAdminClient()
  await supabase
    .from('quickbooks_connections')
    .update({ status: 'reconnect_required', last_error: reason })
    .eq('user_id', ownerId)
}

export async function updateCompanyName(ownerId: string, companyName: string) {
  const supabase = createAdminClient()
  await supabase.from('quickbooks_connections').update({ company_name: companyName }).eq('user_id', ownerId)
}

// Appelé après chaque tentative de synchro (succès, erreur générique, ou
// reconnexion requise) — distinct de `status` (connecté/déconnecté) : une
// synchro peut échouer ponctuellement sans que la connexion elle-même soit
// perdue (ex: un appel de query a échoué après ses 3 essais).
export async function updateSyncStatus(ownerId: string, status: QuickBooksSyncStatus) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('quickbooks_connections')
    .update({ last_sync_at: new Date().toISOString(), last_sync_status: status })
    .eq('user_id', ownerId)
  if (error) throw new Error(`[quickbooks] mise à jour du statut de synchro échouée — ${error.message}`)
}

// Déconnexion volontaire — nettoie les jetons (après révocation côté Intuit,
// cf. oauth.ts revokeToken) mais conserve la ligne pour l'historique/audit.
export async function clearConnection(ownerId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('quickbooks_connections')
    .update({
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
      status: 'disconnected',
      last_error: null,
    })
    .eq('user_id', ownerId)

  if (error) throw new Error(`[quickbooks] nettoyage connexion échoué — ${error.message}`)
}
