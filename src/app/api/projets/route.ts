import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select('*, client:clients(id, name, company)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, client_id, priority, deadline, tags, status } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      client_id: client_id || null,
      priority: priority || 'normale',
      deadline: deadline || null,
      tags: tags || [],
      status: status || 'todo',
    })
    .select('*, client:clients(id, name, company)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
