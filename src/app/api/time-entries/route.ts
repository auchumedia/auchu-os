import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

const ENTRY_SELECT = 'id, task_id, user_id, started_at, ended_at, duration_seconds, entry_type, note'

// Calcule la durée finale d'une entrée en cours ou en pause, à l'instant présent.
function computeElapsed(accumulatedSeconds: number, segmentStartedAt: string | null, now: Date) {
  const segment = segmentStartedAt
    ? Math.max(0, Math.round((now.getTime() - new Date(segmentStartedAt).getTime()) / 1000))
    : 0
  return accumulatedSeconds + segment
}

// Historique des sessions d'une tâche (timer + manuel), le plus récent en premier.
export async function GET(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const taskId = new URL(req.url).searchParams.get('task_id')
  if (!taskId) return NextResponse.json({ error: 'task_id requis' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_entries')
    .select(ENTRY_SELECT)
    .eq('task_id', taskId)
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// Démarre un chrono sur une tâche. Une seule entrée active (en cours OU en
// pause) par utilisateur — imposé aussi par l'index unique partiel côté DB
// (migration 038). On finalise proprement l'ancienne entrée (si elle existe,
// qu'elle soit en cours ou en pause) avant d'en insérer une nouvelle.
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
    .select('id, task_id, accumulated_seconds, segment_started_at')
    .eq('user_id', ctx.userId)
    .is('ended_at', null)
    .maybeSingle()

  if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 })

  let stopped: { id: string; task_id: string; duration_seconds: number } | null = null

  if (activeEntry) {
    const now = new Date()
    const durationSeconds = computeElapsed(activeEntry.accumulated_seconds, activeEntry.segment_started_at, now)

    const { error: stopError } = await supabase
      .from('time_entries')
      .update({ ended_at: now.toISOString(), duration_seconds: durationSeconds, segment_started_at: null })
      .eq('id', activeEntry.id)

    if (stopError) return NextResponse.json({ error: stopError.message }, { status: 500 })
    stopped = { id: activeEntry.id, task_id: activeEntry.task_id, duration_seconds: durationSeconds }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      task_id: taskId,
      user_id: ctx.userId,
      client_id: task.client_id,
      started_at: now,
      segment_started_at: now,
      accumulated_seconds: 0,
      entry_type: 'timer',
    })
    .select('id, task_id, user_id, started_at, accumulated_seconds, segment_started_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, stopped }, { status: 201 })
}
