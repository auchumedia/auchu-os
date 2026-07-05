import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

const ENTRY_SELECT = 'id, task_id, user_id, started_at, accumulated_seconds, segment_started_at, ended_at, duration_seconds, entry_type, note'

function computeElapsed(accumulatedSeconds: number, segmentStartedAt: string | null, now: Date) {
  const segment = segmentStartedAt
    ? Math.max(0, Math.round((now.getTime() - new Date(segmentStartedAt).getTime()) / 1000))
    : 0
  return accumulatedSeconds + segment
}

// Actions sur le chrono actif : pause | resume | stop (défaut : stop, pour
// compatibilité avec l'appel initial "PATCH sans body" = arrêter).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('time_entries')
    .select('id, task_id, user_id, accumulated_seconds, segment_started_at, ended_at')
    .eq('id', params.id)
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Entrée introuvable' }, { status: 404 })
  if (existing.ended_at) return NextResponse.json({ error: 'Ce chrono est déjà arrêté' }, { status: 400 })

  let body: { action?: string } = {}
  try { body = await req.json() } catch { /* body vide = stop, comportement historique */ }
  const action = body.action ?? 'stop'

  const now = new Date()
  let fields: Record<string, unknown>

  if (action === 'pause') {
    if (!existing.segment_started_at) {
      return NextResponse.json({ error: 'Ce chrono est déjà en pause' }, { status: 400 })
    }
    fields = {
      accumulated_seconds: computeElapsed(existing.accumulated_seconds, existing.segment_started_at, now),
      segment_started_at: null,
    }
  } else if (action === 'resume') {
    if (existing.segment_started_at) {
      return NextResponse.json({ error: 'Ce chrono est déjà en cours' }, { status: 400 })
    }
    fields = { segment_started_at: now.toISOString() }
  } else if (action === 'stop') {
    fields = {
      ended_at: now.toISOString(),
      duration_seconds: computeElapsed(existing.accumulated_seconds, existing.segment_started_at, now),
      segment_started_at: null,
    }
  } else {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update(fields)
    .eq('id', params.id)
    .select(ENTRY_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// Supprime une session terminée (historique). On bloque la suppression d'une
// session en cours/en pause pour éviter de désynchroniser le chrono actif
// affiché côté client — il faut d'abord l'arrêter.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('time_entries')
    .select('id, task_id, user_id, ended_at')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Entrée introuvable' }, { status: 404 })
  if (existing.user_id !== ctx.userId) {
    return NextResponse.json({ error: 'Tu ne peux supprimer que tes propres sessions' }, { status: 403 })
  }
  if (!existing.ended_at) {
    return NextResponse.json({ error: 'Arrête le chrono avant de supprimer cette session' }, { status: 400 })
  }

  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, task_id: existing.task_id })
}
