import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const start  = searchParams.get('start') ?? ''
  const end    = searchParams.get('end')   ?? ''
  const team   = searchParams.get('team') === '1'
  const scope  = searchParams.get('scope') // 'own-team' — chef_equipe uniquement
  const member = searchParams.get('member')

  const supabase = await createClient()

  const orgWide = team && (ctx.isOwner || ctx.isDirector)
  const ownTeam = scope === 'own-team' && ctx.isTeamChef && !!ctx.teamId

  // ── Équipe du chef : clients + membres, pour filtrer calendar_events/content ─
  let teamClientIds: string[] = []
  let teamMemberIds: string[] = []
  if (ownTeam) {
    const [teamClientsRes, teamMembersRes] = await Promise.all([
      supabase.from('team_clients').select('client_id').eq('team_id', ctx.teamId as string),
      supabase.from('team_memberships').select('user_id').eq('team_id', ctx.teamId as string),
    ])
    teamClientIds = (teamClientsRes.data ?? []).map(c => c.client_id)
    teamMemberIds = [...(teamMembersRes.data ?? []).map(m => m.user_id), ctx.userId]
  }

  // ── calendar_events ───────────────────────────────────────────────────────
  let eventsQuery = supabase
    .from('calendar_events')
    .select('id, user_id, title, date, type, notes, client:clients(id, name)')
    .gte('date', start)
    .lte('date', end)
    .order('date')

  if (orgWide) {
    // owner/director : pas de filtre user_id (les policies couvrent toute l'org)
    if (member) eventsQuery = eventsQuery.eq('user_id', member)
  } else if (ownTeam) {
    const clientFilter = teamClientIds.length > 0 ? `client_id.in.(${teamClientIds.join(',')}),` : ''
    eventsQuery = eventsQuery.or(`${clientFilter}user_id.in.(${teamMemberIds.join(',')})`)
  } else {
    // Vue personnelle : les événements appartiennent à l'utilisateur courant
    // (créés avec user_id = ctx.userId), pas au owner du workspace.
    eventsQuery = eventsQuery.eq('user_id', ctx.userId)
  }

  const { data: rawEvents } = await eventsQuery

  // ── content_pieces avec scheduled_at ────────────────────────────────────────
  let contentsQuery = supabase
    .from('content_pieces')
    .select('id, title, scheduled_at, client:clients(name)')
    .eq('user_id', ctx.dataOwnerId)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', start)
    .lte('scheduled_at', end + 'T23:59:59')

  if (ownTeam) {
    // Calendrier de contenu de toute l'équipe, non filtré par assignation perso.
    contentsQuery = contentsQuery.in('client_id', teamClientIds.length > 0 ? teamClientIds : ['00000000-0000-0000-0000-000000000000'])
  } else if (!orgWide) {
    // Vue personnelle : uniquement le contenu assigné à l'utilisateur courant
    contentsQuery = contentsQuery.eq('assigned_user_id', ctx.userId)
  }

  const { data: contents } = await contentsQuery

  // ── profiles pour les noms d'équipe ───────────────────────────────────────
  const seen: Record<string, true> = {}
  const userIds = (rawEvents ?? []).map((e: any) => e.user_id as string).filter(id => { if (seen[id]) return false; seen[id] = true; return true })
  let profileMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    ;(profiles ?? []).forEach((p: any) => {
      profileMap[p.id] = p.full_name ?? p.email ?? 'Inconnu'
    })
  }

  const events = [
    ...(rawEvents ?? []).map((e: any) => ({
      id:         e.id,
      title:      e.title,
      date:       e.date,
      type:       e.type,
      userId:     e.user_id,
      userName:   profileMap[e.user_id] ?? null,
      clientName: (e.client as any)?.name ?? null,
      source:     'calendar' as const,
    })),
    ...(contents ?? []).map((c: any) => ({
      id:         `content-${c.id}`,
      title:      c.title,
      date:       (c.scheduled_at as string).slice(0, 10),
      type:       'contenu' as const,
      userId:     ctx.dataOwnerId,
      userName:   null,
      clientName: (c.client as any)?.name ?? null,
      source:     'content' as const,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ events })
}

export async function POST(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, type, date, client_id, notes } = await req.json()
  if (!title || !type || !date) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      user_id:   ctx.userId,
      client_id: client_id || null,
      type,
      title,
      date,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}

export async function DELETE(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
