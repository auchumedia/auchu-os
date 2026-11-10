import { getOrgContext } from '@/lib/org'
import { canViewFinance } from '@/lib/roles'
import { getConnection, updateCompanyName } from '@/lib/quickbooks/connection'
import { fetchCompanyInfo } from '@/lib/quickbooks/client'
import { QuickBooksReconnectRequiredError } from '@/lib/quickbooks/errors'
import { NextResponse } from 'next/server'

// Jamais de données financières renvoyées ici pour un rôle autre que
// owner/director — même en cas de bug ailleurs, ce 403 est la dernière
// barrière avant que l'UI n'affiche quoi que ce soit.
export async function GET() {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewFinance(ctx.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const connection = await getConnection(ctx.dataOwnerId)

  if (!connection || connection.status === 'disconnected') {
    return NextResponse.json({ connected: false, status: 'disconnected' as const })
  }

  if (connection.status === 'reconnect_required') {
    return NextResponse.json({
      connected: false, status: 'reconnect_required' as const,
      companyName: connection.companyName, environment: connection.environment,
      lastSyncAt: connection.lastSyncAt, lastSyncStatus: connection.lastSyncStatus,
    })
  }

  // Vérifie que le jeton fonctionne réellement (et pas seulement que la
  // ligne existe) — un appel réel à l'API QuickBooks, via le wrapper qui
  // gère rafraîchissement + retries (client.ts).
  try {
    const companyName = await fetchCompanyInfo(ctx.dataOwnerId)
    if (companyName && companyName !== connection.companyName) {
      await updateCompanyName(ctx.dataOwnerId, companyName)
    }
    return NextResponse.json({
      connected: true, status: 'connected' as const,
      companyName: companyName ?? connection.companyName,
      environment: connection.environment,
      lastSyncAt: connection.lastSyncAt, lastSyncStatus: connection.lastSyncStatus,
    })
  } catch (e) {
    if (e instanceof QuickBooksReconnectRequiredError) {
      return NextResponse.json({
        connected: false, status: 'reconnect_required' as const,
        companyName: connection.companyName, environment: connection.environment,
        lastSyncAt: connection.lastSyncAt, lastSyncStatus: connection.lastSyncStatus,
      })
    }
    // Erreur transitoire (réseau, 5xx persistant après retries...) — on ne
    // dégrade PAS le statut en "reconnect_required" pour ça, l'UI reste sur
    // la dernière info connue plutôt que de planter.
    console.error('[quickbooks/status] vérification de connectivité échouée —', e instanceof Error ? e.message : e)
    return NextResponse.json({
      connected: true, status: 'connected' as const,
      companyName: connection.companyName,
      environment: connection.environment,
      lastSyncAt: connection.lastSyncAt, lastSyncStatus: connection.lastSyncStatus,
      degraded: true,
    })
  }
}
