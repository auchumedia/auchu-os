import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

// Pas d'embed profile:profiles(...) sur team_memberships : dépend du cache de
// relations PostgREST, qui peut rester périmé après une migration DDL et faire
// échouer la requête (PGRST200) silencieusement. Profils récupérés séparément.
const TEAM_SELECT = `
  id, org_id, name, chef_id, created_at, updated_at,
  members:team_memberships(id, user_id, role, joined_at),
  clients:team_clients(id, client_id, assigned_at, client:clients(id, name, company, status))
`

async function attachProfiles(supabase: Awaited<ReturnType<typeof createClient>>, teams: any[]) {
  const userIds = Array.from(new Set(teams.flatMap(t => (t.members ?? []).map((m: any) => m.user_id))))
  if (userIds.length === 0) return teams

  const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', userIds)
  const profileByUserId = new Map((profiles ?? []).map(p => [p.id, p]))

  return teams.map(t => ({
    ...t,
    members: (t.members ?? []).map((m: any) => ({ ...m, profile: profileByUserId.get(m.user_id) ?? null })),
  }))
}

export async function GET() {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org) return NextResponse.json({ error: 'Aucune organisation' }, { status: 404 })

  const supabase = await createClient()

  if (ctx.canManageOrgStructure) {
    const { data: teams, error } = await supabase
      .from('teams')
      .select(TEAM_SELECT)
      .eq('org_id', ctx.org.id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ teams: await attachProfiles(supabase, teams ?? []) })
  }

  if (!ctx.teamId) return NextResponse.json({ teams: [] })

  const { data: team, error } = await supabase
    .from('teams')
    .select(TEAM_SELECT)
    .eq('id', ctx.teamId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ teams: team ? await attachProfiles(supabase, [team]) : [] })
}

export async function POST(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org || !ctx.canManageOrgStructure) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { name, chef_id } = await req.json()
  if (!name?.trim() || !chef_id) {
    return NextResponse.json({ error: 'Nom et chef d\'équipe requis' }, { status: 400 })
  }

  const supabase = await createClient()

  // Le chef choisi doit déjà avoir le rôle chef_equipe et ne pas diriger d'équipe.
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

  const { data: existingTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('chef_id', chef_id)
    .maybeSingle()

  if (existingTeam) return NextResponse.json({ error: 'Ce membre dirige déjà une équipe' }, { status: 409 })

  const { data: team, error } = await supabase
    .rpc('create_team', { p_org_id: ctx.org.id, p_name: name.trim(), p_chef_id: chef_id })
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: team })
}
