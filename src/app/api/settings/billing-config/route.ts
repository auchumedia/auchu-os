import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

export async function PATCH(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org) return NextResponse.json({ error: 'Aucune organisation' }, { status: 404 })

  const body = await req.json()
  const { billing_mode, hourly_rate, fixed_rate, currency, period, payment_info } = body

  if (!['hourly', 'fixed'].includes(billing_mode)) {
    return NextResponse.json({ error: 'Mode de facturation invalide' }, { status: 400 })
  }
  if (!['weekly', 'biweekly', 'monthly'].includes(period)) {
    return NextResponse.json({ error: 'Période de facturation invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('member_billing_config')
    .upsert({
      user_id:      ctx.userId,
      org_id:       ctx.org.id,
      billing_mode,
      hourly_rate:  billing_mode === 'hourly' ? (hourly_rate ? Number(hourly_rate) : null) : null,
      fixed_rate:   billing_mode === 'fixed'  ? (fixed_rate  ? Number(fixed_rate)  : null) : null,
      currency:     currency?.trim() || 'CAD',
      period,
      payment_info: payment_info?.trim() || null,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
