import { getOrgContext } from '@/lib/org'
import { createClient } from '@/lib/supabase/server'
import { canViewFinance } from '@/lib/roles'
import { syncQuickBooksData } from '@/lib/quickbooks/sync'
import { updateSyncStatus } from '@/lib/quickbooks/connection'
import { QuickBooksReconnectRequiredError, QuickBooksNotConnectedError } from '@/lib/quickbooks/errors'
import { NextResponse } from 'next/server'

// owner ou director — même gating que /api/quickbooks/status (canViewFinance).
export async function POST() {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewFinance(ctx.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Client lié à la session (RLS owner/director sur finance_revenues/finance_expenses,
  // migration 047) — pas le client admin, celui-ci n'est utilisé que pour
  // quickbooks_connections (lib/quickbooks/connection.ts).
  const supabase = await createClient()

  try {
    const result = await syncQuickBooksData(supabase, ctx.dataOwnerId)
    // Chaque ressource (Invoice/Purchase/Bill) a été lue indépendamment —
    // result.errors contient celles qui ont échoué sans bloquer les autres
    // (ex: "Bill (factures fournisseurs) indisponible — HTTP 400" quand le
    // forfait QuickBooks ne les inclut pas). On garde ce détail dans
    // last_error même si le reste de la synchro a réussi ; null pour
    // effacer un message d'une synchro précédente quand tout a réussi.
    if (result.errors.length > 0) {
      await updateSyncStatus(ctx.dataOwnerId, 'error', result.errors.join(' | '))
    } else {
      await updateSyncStatus(ctx.dataOwnerId, 'success', null)
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    if (e instanceof QuickBooksReconnectRequiredError) {
      // markReconnectRequired() (lib/quickbooks/client.ts) vient déjà
      // d'écrire le vrai motif dans last_error — ne pas l'écraser ici.
      await updateSyncStatus(ctx.dataOwnerId, 'reconnect_required')
      return NextResponse.json({ error: 'reconnect_required' }, { status: 409 })
    }
    if (e instanceof QuickBooksNotConnectedError) {
      return NextResponse.json({ error: 'not_connected' }, { status: 409 })
    }
    console.error('[quickbooks/sync] échec —', e instanceof Error ? e.message : e)
    try { await updateSyncStatus(ctx.dataOwnerId, 'error', e instanceof Error ? e.message : 'Erreur inconnue') } catch { /* ne masque pas l'erreur d'origine */ }
    return NextResponse.json({ error: 'Synchronisation échouée' }, { status: 500 })
  }
}
