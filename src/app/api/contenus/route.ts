import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('content_pieces')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data, error } = await supabase
    .from('content_pieces')
    .insert({
      user_id:     user.id,
      client_id:   body.client_id,
      title:       body.title,
      type:        body.type       ?? 'post',
      platform:    body.platform   ?? 'instagram',
      status:      body.status     ?? 'idee',
      description: body.description ?? null,
      script:      body.script     ?? null,
      assigned_to: body.assigned_to ?? null,
      scheduled_at: body.scheduled_at ?? null,
      body:        body.script ?? body.body ?? '',
      variants:    [],
      ai_generated: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
