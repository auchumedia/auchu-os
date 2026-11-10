import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { canViewFinance } from '@/lib/roles'
import { NextResponse } from 'next/server'

// Section Finances — owner/director uniquement (cf. src/lib/roles.ts
// canViewFinance + RLS "revenues: director *", migration 047). stratege et
// monteur reçoivent un 403 sans jamais toucher la table.
function canManage(ctx: { role: string }) {
  return canViewFinance(ctx.role)
}

export async function GET(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // 'YYYY-MM'
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Paramètre month invalide (attendu YYYY-MM)' }, { status: 400 })
  }

  const [y, m] = month.split('-').map(Number)
  const startISO = new Date(y, m - 1, 1).toISOString().split('T')[0]
  const endISO   = new Date(y, m, 1).toISOString().split('T')[0]

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('revenues')
    .select('id, client_id, amount, entry_date, description, source, created_at, client:clients(name)')
    .eq('user_id', ctx.dataOwnerId)
    .gte('entry_date', startISO)
    .lt('entry_date', endISO)
    .order('entry_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const amount     = Number(body.amount)
  const entry_date = body.entry_date
  const client_id  = body.client_id || null
  const description = body.description?.trim() || null

  if (!amount || amount <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  if (!entry_date) return NextResponse.json({ error: 'Date requise' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('revenues')
    .insert({
      user_id: ctx.dataOwnerId,
      client_id,
      amount,
      entry_date,
      description,
      source: 'manual',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function DELETE(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('revenues')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.dataOwnerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
