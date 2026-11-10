import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

// ══════════════════════════════════════════════════════════════════════════════
// Client admin — clé service_role, contourne TOUJOURS les RLS côté Supabase.
//
// SERVER-ONLY. Ne JAMAIS importer ce module depuis un composant 'use client'
// ni l'exposer au navigateur — SUPABASE_SERVICE_ROLE_KEY n'a pas le préfixe
// NEXT_PUBLIC_ et n'est donc pas inlinée dans le bundle navigateur, mais la
// discipline d'import reste la vraie garantie : ce fichier n'est appelé que
// par src/lib/quickbooks/connection.ts, lui-même utilisé uniquement depuis
// des route handlers serveur. quickbooks_connections (jetons chiffrés) n'a
// plus aucune policy RLS pour authenticated/anon depuis la migration 049 —
// cette table n'est lisible/écrivable que via ce client.
// ══════════════════════════════════════════════════════════════════════════════

let cached: SupabaseClient<any> | null = null

export function createAdminClient(): SupabaseClient<any> {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL manquant')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant — requis pour accéder à quickbooks_connections côté serveur')

  cached = createSupabaseClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
