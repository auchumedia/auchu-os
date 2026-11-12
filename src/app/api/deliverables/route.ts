import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { fetchClientDeliverableRows } from '@/lib/deliverablesServer'
import { monthKeyFromDate, monthKeyFromString } from '@/lib/deliverables'
import { NextResponse } from 'next/server'

// Visible à tous les rôles connectés (pas seulement finance) — scope par
// rôle comme ClientGallery/fetchClientCards : org entière pour owner/
// director, équipe uniquement pour stratege/monteur. Toujours
// ctx.dataOwnerId pour les lectures.
export async function GET(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Paramètre month invalide (attendu YYYY-MM)' }, { status: 400 })
  }

  const supabase = await createClient()

  let clientIds: string[] | null = null
  if (!ctx.isOwner && !ctx.isDirector) {
    clientIds = []
    if (ctx.teamId) {
      const { data: tc } = await supabase.from('team_clients').select('client_id').eq('team_id', ctx.teamId)
      clientIds = (tc ?? []).map(c => c.client_id)
    }
  }

  try {
    // currentMonth = mois réel "aujourd'hui", pas le mois demandé — même si
    // l'utilisateur consulte un mois passé ou futur via le sélecteur, c'est
    // toujours la vraie date du jour qui détermine si ce mois est terminé.
    const result = await fetchClientDeliverableRows(
      supabase, ctx.dataOwnerId, clientIds, monthKeyFromString(month), monthKeyFromDate(new Date()),
    )
    return NextResponse.json(result)
  } catch (e) {
    console.error('[api/deliverables] échec —', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Impossible de calculer les livrables' }, { status: 500 })
  }
}
