import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptToken, decryptToken } from './crypto'
import type { QuickBooksEnvironment } from './config'

export type QuickBooksStatus = 'connected' | 'reconnect_required' | 'disconnected'

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
  }
}

// user_id = toujours ownerId (ctx.dataOwnerId), jamais l'id du membre qui
// clique "Connecter" — même convention que revenues/expenses (migration 047).
export async function getConnection(supabase: SupabaseClient, ownerId: string): Promise<QuickBooksConnection | null> {
  const { data, error } = await supabase
    .from('quickbooks_connections')
    .select('realm_id, environment, access_token_encrypted, refresh_token_encrypted, access_token_expires_at, refresh_token_expires_at, status, company_name, last_error')
    .eq('user_id', ownerId)
    .maybeSingle()

  if (error) throw new Error(`[quickbooks] lecture connexion échouée — ${error.message}`)
  if (!data) return null
  return fromRow(data as DbRow)
}

export async function saveTokens(supabase: SupabaseClient, ownerId: string, params: {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
  realmId: string
  environment: QuickBooksEnvironment
  companyName?: string | null
}) {
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

export async function markReconnectRequired(supabase: SupabaseClient, ownerId: string, reason: string) {
  await supabase
    .from('quickbooks_connections')
    .update({ status: 'reconnect_required', last_error: reason })
    .eq('user_id', ownerId)
}

// Déconnexion volontaire — nettoie les jetons (après révocation côté Intuit,
// cf. oauth.ts revokeToken) mais conserve la ligne pour l'historique/audit.
export async function clearConnection(supabase: SupabaseClient, ownerId: string) {
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
