import { getOrgContext } from '@/lib/org'
import { createClient } from '@/lib/supabase/server'
import { canViewFinance } from '@/lib/roles'
import { getConnection, clearConnection } from '@/lib/quickbooks/connection'
import { revokeToken } from '@/lib/quickbooks/oauth'
import { NextResponse } from 'next/server'

export async function POST() {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewFinance(ctx.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const supabase = await createClient()
  const connection = await getConnection(supabase, ctx.dataOwnerId)

  let revoked = false
  if (connection?.refreshToken) {
    try {
      await revokeToken(connection.refreshToken)
      revoked = true
    } catch (e) {
      // On ne bloque jamais le nettoyage local sur un échec de révocation
      // côté Intuit (jeton déjà expiré/révoqué, panne réseau...) — l'état
      // local doit être nettoyé dans tous les cas.
      console.error('[quickbooks/disconnect] révocation Intuit échouée —', e instanceof Error ? e.message : e)
    }
  }

  await clearConnection(supabase, ctx.dataOwnerId)

  return NextResponse.json({ success: true, revoked })
}
