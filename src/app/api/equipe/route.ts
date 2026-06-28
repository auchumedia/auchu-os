import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, plan, max_members')
    .eq('owner_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Aucune organisation' }, { status: 404 })

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from('org_members')
      .select('id, user_id, role, status, joined_at, profile:profiles(full_name, email, avatar_url)')
      .eq('org_id', org.id)
      .order('joined_at', { ascending: true }),
    supabase
      .from('invitations')
      .select('id, code, role, expires_at, created_at')
      .eq('org_id', org.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    org,
    members:     membersRes.data ?? [],
    invitations: invitesRes.data ?? [],
  })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role } = await req.json()
  if (!['manager', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, plan, max_members')
    .eq('owner_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Aucune organisation' }, { status: 404 })

  // Vérifier la limite du plan
  const { count } = await supabase
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', org.id)
    .eq('status', 'actif')

  if ((count ?? 0) >= org.max_members) {
    return NextResponse.json(
      { error: `Limite atteinte pour le plan ${org.plan} (${org.max_members} membres max)` },
      { status: 403 }
    )
  }

  // Générer un code unique
  let code = generateCode()
  let attempts = 0
  while (attempts < 5) {
    const { data: clash } = await supabase.from('invitations').select('id').eq('code', code).single()
    if (!clash) break
    code = generateCode()
    attempts++
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({ org_id: org.id, code, role, invited_by: user.id, expires_at: expiresAt })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: invitation })
}
