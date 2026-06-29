import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  if (body.role   && ['manager','partner','editor','viewer'].includes(body.role))   allowed.role   = body.role
  if (body.status && ['actif','inactif'].includes(body.status))           allowed.status = body.status

  if (!Object.keys(allowed).length) return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })

  // Ne pas permettre de modifier le owner
  const { data: member } = await supabase
    .from('org_members')
    .select('role')
    .eq('id', params.id)
    .eq('org_id', org.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  if (member.role === 'owner') return NextResponse.json({ error: 'Impossible de modifier le propriétaire' }, { status: 403 })

  const { data, error } = await supabase
    .from('org_members')
    .update(allowed)
    .eq('id', params.id)
    .eq('org_id', org.id)
    .select('*, profile:profiles(full_name, email, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data: member } = await supabase
    .from('org_members')
    .select('role')
    .eq('id', params.id)
    .eq('org_id', org.id)
    .single()

  if (member?.role === 'owner') return NextResponse.json({ error: 'Impossible de retirer le propriétaire' }, { status: 403 })

  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('id', params.id)
    .eq('org_id', org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
