import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')

  // content_pieces.user_id est toujours l'ID du owner de l'org, jamais celui
  // de la personne qui édite (cf. api/contenus/[id]/route.ts) — filtrer sur
  // ctx.userId cassait ce fetch pour tout membre non-owner.
  let query = supabase
    .from('content_pieces')
    .select('*')
    .eq('user_id', ctx.dataOwnerId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()

  const { data: last } = await supabase
    .from('content_pieces')
    .select('position')
    .eq('client_id', body.client_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (last?.position ?? -1) + 1

  // content_pieces.user_id est toujours l'ID du owner de l'org, jamais celui
  // de la personne qui crée — sinon la ligne devient invisible pour tout le
  // monde (owner inclus), tous les reads filtrant sur ctx.dataOwnerId.
  const { data, error } = await supabase
    .from('content_pieces')
    .insert({
      user_id:     ctx.dataOwnerId,
      client_id:   body.client_id,
      title:       body.title,
      type:        body.type       ?? 'post',
      platform:    body.platform   ?? 'instagram',
      status:      body.status     ?? 'idee',
      description: body.description ?? null,
      script:      body.script     ?? null,
      assigned_to: body.assigned_to ?? null,
      scheduled_at: body.scheduled_at ?? null,
      month_target: body.month_target ?? null,
      body:        body.script ?? body.body ?? '',
      variants:    [],
      position:    nextPosition,
      ai_generated: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
