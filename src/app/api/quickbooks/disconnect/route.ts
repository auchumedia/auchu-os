import { getOrgContext } from '@/lib/org'
import { canManageQuickBooksConnection } from '@/lib/roles'
import { getConnection, clearConnection } from '@/lib/quickbooks/connection'
import { revokeToken } from '@/lib/quickbooks/oauth'
import { NextResponse } from 'next/server'

// Réservé au propriétaire — cf. api/quickbooks/connect/route.ts.
export async function POST() {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageQuickBooksConnection(ctx.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const connection = await getConnection(ctx.dataOwnerId)

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

  await clearConnection(ctx.dataOwnerId)

  return NextResponse.json({ success: true, revoked })
}
