import { getOrgContext } from '@/lib/org'
import { canManageQuickBooksConnection } from '@/lib/roles'
import { getConnection, clearConnection } from '@/lib/quickbooks/connection'
import { revokeToken } from '@/lib/quickbooks/oauth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Supprime, avec le client admin (service_role — ces tables n'ont pas besoin
// d'être accessibles autrement ici), toutes les lignes importées de
// QuickBooks pour ce propriétaire. Ne touche JAMAIS une entrée manuelle :
// le filtre source = 'quickbooks' l'exclut par construction (les entrées
// manuelles ont source = 'manual').
async function deleteImportedFinanceData(ownerId: string) {
  const admin = createAdminClient()
  for (const table of ['finance_revenues', 'finance_expenses'] as const) {
    const { error } = await admin.from(table).delete().eq('user_id', ownerId).eq('source', 'quickbooks')
    if (error) throw new Error(`[quickbooks/disconnect] suppression ${table} échouée — ${error.message}`)
  }
}

// Réservé au propriétaire — cf. api/quickbooks/connect/route.ts.
export async function POST(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageQuickBooksConnection(ctx.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const deleteImportedData = body?.deleteImportedData === true

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

  let dataDeleted = false
  if (deleteImportedData) {
    try {
      await deleteImportedFinanceData(ctx.dataOwnerId)
      dataDeleted = true
    } catch (e) {
      // La déconnexion elle-même ne doit pas échouer si la suppression des
      // données importées rate — on la journalise et on continue.
      console.error('[quickbooks/disconnect] suppression des données importées échouée —', e instanceof Error ? e.message : e)
    }
  }

  await clearConnection(ctx.dataOwnerId)

  return NextResponse.json({ success: true, revoked, dataDeleted })
}
