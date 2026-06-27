import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    name, email, phone, company, industry,
    status, monthly_budget, brand_tone, brand_notes, platforms,
  } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      user_id: user.id,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
      industry: industry?.trim() || null,
      status: status || 'prospect',
      monthly_budget: monthly_budget ? Number(monthly_budget) : null,
      brand_tone: brand_tone?.trim() || null,
      brand_notes: brand_notes?.trim() || null,
      platforms: platforms || [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
