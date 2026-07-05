import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

// Démarre un chrono sur une tâche. Une seule entrée active par utilisateur —
// imposé aussi par l'index unique partiel côté DB (migration 038) ; ici on
// arrête proprement l'ancienne entrée active (si elle existe) avant d'en
// insérer une nouvelle, pour renvoyer son duration_seconds au client et lui
// permettre de mettre à jour le total affiché sur l'ancienne carte.
export async function POST(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const taskId = body?.task_id
  if (!taskId) return NextResponse.json({ error: 'task_id requis' }, { status: 400 })

  const supabase = await createClient()

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, client_id')
    .eq('id', taskId)
    .eq('user_id', ctx.dataOwnerId)
    .maybeSingle()

  if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 })
  if (!task) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  const { data: activeEntry, error: activeError } = await supabase
    .from('time_entries')
    .select('id, task_id, started_at')
    .eq('user_id', ctx.userId)
    .is('ended_at', null)
    .maybeSingle()

  if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 })

  let stopped: { task_id: string; duration_seconds: number } | null = null

  if (activeEntry) {
    const now = new Date()
    const durationSeconds = Math.max(0, Math.round(
      (now.getTime() - new Date(activeEntry.started_at).getTime()) / 1000
    ))

    const { error: stopError } = await supabase
      .from('time_entries')
      .update({ ended_at: now.toISOString(), duration_seconds: durationSeconds })
      .eq('id', activeEntry.id)

    if (stopError) return NextResponse.json({ error: stopError.message }, { status: 500 })
    stopped = { task_id: activeEntry.task_id, duration_seconds: durationSeconds }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      task_id: taskId,
      user_id: ctx.userId,
      client_id: task.client_id,
    })
    .select('id, task_id, user_id, started_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, stopped }, { status: 201 })
}
