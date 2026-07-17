import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const TPS = 0.05
const TVQ = 0.09975

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('invoices')
    .select('*, client:clients(id, name, email, company)')
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
  const { client_id, invoice_number, items, due_date, notes, status } = body

  if (!items?.length) {
    return NextResponse.json({ error: 'Au moins un article est requis' }, { status: 400 })
  }

  const enrichedItems = items.map((item: { description: string; quantity: number; unit_price: number }) => ({
    ...item,
    total: round2(item.quantity * item.unit_price),
  }))

  const subtotal = round2(enrichedItems.reduce((s: number, i: { total: number }) => s + i.total, 0))
  const tps_amount = round2(subtotal * TPS)
  const tvq_amount = round2(subtotal * TVQ)
  const tax_amount = round2(tps_amount + tvq_amount)
  const total = round2(subtotal + tax_amount)

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      user_id: user.id,
      client_id: client_id || null,
      invoice_number,
      items: enrichedItems,
      subtotal,
      tax_rate: 14.98,
      tps_amount,
      tvq_amount,
      tax_amount,
      total,
      due_date: due_date || null,
      notes: notes || null,
      status: status || 'envoye',
    })
    .select('*, client:clients(id, name, email, company)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
