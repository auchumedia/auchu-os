import { createClient }     from '@/lib/supabase/server'
import { getOrgContext }    from '@/lib/org'
import { canManageClients } from '@/lib/roles'
import { NextResponse }     from 'next/server'

export async function GET() {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, email, company, status')
    .eq('user_id', ctx.dataOwnerId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageClients(ctx.role)) {
    return NextResponse.json({ error: 'Accès refusé — rôle stratège/monteur en lecture seule sur les clients' }, { status: 403 })
  }

  const body = await req.json()
  const {
    name, email, phone, company, industry,
    status, monthly_budget, brand_tone, brand_notes, platforms,
  } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .insert({
      user_id: ctx.dataOwnerId,
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

  // Un chef_equipe qui crée un client se l'assigne automatiquement à sa
  // propre équipe — sinon "clients: team read" le rendrait invisible pour
  // lui-même juste après l'avoir créé.
  if (ctx.isTeamChef && ctx.teamId) {
    await supabase.from('team_clients').insert({ team_id: ctx.teamId, client_id: data.id })
  }

  return NextResponse.json({ data }, { status: 201 })
}
