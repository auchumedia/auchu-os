import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('expenses')
    .select('*, client:clients(id, name)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, amount, category, date, client_id, notes } = body

  if (!title?.trim() || !amount) {
    return NextResponse.json({ error: 'Titre et montant requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      title: title.trim(),
      amount: Number(amount),
      category: category || 'autre',
      date: date || new Date().toISOString().split('T')[0],
      client_id: client_id || null,
      notes: notes?.trim() || null,
    })
    .select('*, client:clients(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
