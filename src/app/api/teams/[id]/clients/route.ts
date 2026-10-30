import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org || !ctx.canManageOrgStructure) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId requis' }, { status: 400 })

  const supabase = await createClient()

  const { data: team } = await supabase.from('teams').select('id').eq('id', params.id).eq('org_id', ctx.org.id).maybeSingle()
  if (!team) return NextResponse.json({ error: 'Équipe introuvable' }, { status: 404 })

  // Upsert : déplace le client vers cette équipe s'il était déjà assigné ailleurs.
  const { data, error } = await supabase
    .from('team_clients')
    .upsert({ team_id: params.id, client_id: clientId }, { onConflict: 'client_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org || !ctx.canManageOrgStructure) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId requis' }, { status: 400 })

  const supabase = await createClient()

  const { error } = await supabase
    .from('team_clients')
    .delete()
    .eq('team_id', params.id)
    .eq('client_id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
