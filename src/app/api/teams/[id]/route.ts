import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org || !ctx.canManageOrgStructure) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { name, chef_id } = await req.json()
  const supabase = await createClient()

  const { data: team } = await supabase
    .from('teams')
    .select('id, org_id')
    .eq('id', params.id)
    .eq('org_id', ctx.org.id)
    .maybeSingle()

  if (!team) return NextResponse.json({ error: 'Équipe introuvable' }, { status: 404 })

  if (chef_id) {
    const { data: candidate } = await supabase
      .from('org_members')
      .select('user_id, role')
      .eq('org_id', ctx.org.id)
      .eq('user_id', chef_id)
      .eq('status', 'actif')
      .maybeSingle()

    if (!candidate || candidate.role !== 'chef_equipe') {
      return NextResponse.json({ error: 'Ce membre doit d\'abord avoir le rôle chef_equipe' }, { status: 400 })
    }

    const { error: rpcError } = await supabase.rpc('reassign_team_chef', { p_team_id: params.id, p_new_chef_id: chef_id })
    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  if (name?.trim()) {
    const { error } = await supabase.from('teams').update({ name: name.trim() }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('teams')
    .select('id, org_id, name, chef_id, created_at, updated_at')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org || !ctx.canManageOrgStructure) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const supabase = await createClient()

  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', params.id)
    .eq('org_id', ctx.org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
