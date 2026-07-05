import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

export async function POST(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { task_id, date, hours, minutes, note } = body

  if (!task_id || !date) {
    return NextResponse.json({ error: 'task_id et date requis' }, { status: 400 })
  }

  const h = Number(hours) || 0
  const m = Number(minutes) || 0
  const durationSeconds = Math.round(h * 3600 + m * 60)

  if (durationSeconds <= 0) {
    return NextResponse.json({ error: 'La durée doit être supérieure à zéro' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, client_id')
    .eq('id', task_id)
    .eq('user_id', ctx.dataOwnerId)
    .maybeSingle()

  if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 })
  if (!task) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  const startedAt = new Date(`${date}T12:00:00`)
  if (isNaN(startedAt.getTime())) {
    return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
  }
  const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000)

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      task_id,
      user_id: ctx.userId,
      client_id: task.client_id,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      segment_started_at: null,
      entry_type: 'manual',
      note: note?.trim() || null,
    })
    .select('id, task_id, user_id, started_at, ended_at, duration_seconds, entry_type, note')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
