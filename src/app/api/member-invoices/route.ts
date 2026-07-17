import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

const BILLABLE_ROLES = ['director', 'chef_equipe', 'stratege', 'monteur']

export async function POST(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!BILLABLE_ROLES.includes(ctx.role) || !ctx.org) {
    return NextResponse.json({ error: 'Seuls les membres facturables peuvent créer une facture' }, { status: 403 })
  }

  const body = await req.json()
  const { period_start, period_end, items, total, billing_mode, rate, currency, payment_info } = body

  if (!period_start || !period_end) {
    return NextResponse.json({ error: 'Période requise' }, { status: 400 })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Aucun élément à facturer pour cette période' }, { status: 400 })
  }
  if (!['hourly', 'fixed'].includes(billing_mode)) {
    return NextResponse.json({ error: 'Mode de facturation invalide' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('member_invoices')
    .insert({
      org_id:       ctx.org.id,
      member_id:    ctx.userId,
      period_start,
      period_end,
      items,
      total:        Number(total) || 0,
      currency:     currency || 'CAD',
      billing_mode,
      rate:         rate != null ? Number(rate) : null,
      payment_info: payment_info || null,
      status:       'brouillon',
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
