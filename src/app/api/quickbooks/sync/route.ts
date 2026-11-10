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
    await updateSyncStatus(ctx.dataOwnerId, 'success')
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    if (e instanceof QuickBooksReconnectRequiredError) {
      await updateSyncStatus(ctx.dataOwnerId, 'reconnect_required')
      return NextResponse.json({ error: 'reconnect_required' }, { status: 409 })
    }
    if (e instanceof QuickBooksNotConnectedError) {
      return NextResponse.json({ error: 'not_connected' }, { status: 409 })
    }
    console.error('[quickbooks/sync] échec —', e instanceof Error ? e.message : e)
    try { await updateSyncStatus(ctx.dataOwnerId, 'error') } catch { /* ne masque pas l'erreur d'origine */ }
    return NextResponse.json({ error: 'Synchronisation échouée' }, { status: 500 })
  }
}
