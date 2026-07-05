import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

// Arrête le chrono actif d'un utilisateur. Vérification explicite avant
// update (même raison que api/taches/[id] : sans ça, une RLS qui bloque
// silencieusement l'update renverrait success sur 0 ligne modifiée).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('time_entries')
    .select('id, task_id, user_id, started_at, ended_at')
    .eq('id', params.id)
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Entrée introuvable' }, { status: 404 })
  if (existing.ended_at) return NextResponse.json({ error: 'Ce chrono est déjà arrêté' }, { status: 400 })

  const now = new Date()
  const durationSeconds = Math.max(0, Math.round(
    (now.getTime() - new Date(existing.started_at).getTime()) / 1000
  ))

  const { data, error } = await supabase
    .from('time_entries')
    .update({ ended_at: now.toISOString(), duration_seconds: durationSeconds })
    .eq('id', params.id)
    .select('id, task_id, user_id, started_at, ended_at, duration_seconds')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
