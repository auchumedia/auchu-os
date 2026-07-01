import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

function canManageThisTeam(ctx: Awaited<ReturnType<typeof getOrgContext>>, teamId: string) {
  if (!ctx) return false
  if (ctx.canManageOrgStructure) return true
  return ctx.isTeamChef && ctx.teamId === teamId
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org || !canManageThisTeam(ctx, params.id)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  const supabase = await createClient()

  const { data: target } = await supabase
    .from('org_members')
    .select('user_id, role')
    .eq('org_id', ctx.org.id)
    .eq('user_id', userId)
    .eq('status', 'actif')
    .maybeSingle()

  if (!target || !['stratege', 'monteur'].includes(target.role)) {
    return NextResponse.json({ error: 'Ce membre doit avoir le rôle stratège ou monteur' }, { status: 400 })
  }

  const { data: alreadyOnTeam } = await supabase
    .from('team_memberships')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (alreadyOnTeam) return NextResponse.json({ error: 'Ce membre appartient déjà à une équipe' }, { status: 409 })

  const { data, error } = await supabase
    .from('team_memberships')
    .insert({ team_id: params.id, user_id: userId, role: target.role })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org || !canManageThisTeam(ctx, params.id)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  const supabase = await createClient()

  const { error } = await supabase
    .from('team_memberships')
    .delete()
    .eq('team_id', params.id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
