import { createClient }         from '@/lib/supabase/server'
import { sendInvitationEmail }   from '@/lib/email'
import { NextResponse }          from 'next/server'

const OWNER_EMAIL = 'raphael@auchumedia.com'

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
      .select('id, code, role, expires_at, created_at, invited_name, invited_email')
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

  const body = await req.json()
  const { role, first_name, last_name, email } = body

  if (!['manager', 'partner', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }
  if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Prénom, nom et email sont requis' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, plan, max_members')
    .eq('owner_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Aucune organisation' }, { status: 404 })

  // Compte owner : pas de limite de membres
  const effectiveMax = user.email === OWNER_EMAIL ? 999 : org.max_members

  const { count } = await supabase
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', org.id)
    .eq('status', 'actif')

  if ((count ?? 0) >= effectiveMax) {
    return NextResponse.json(
      { error: `Limite atteinte pour le plan ${org.plan} (${org.max_members} membres max)` },
      { status: 403 }
    )
  }

  // Générer un code unique
  let code = generateCode()
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await supabase.from('invitations').select('id').eq('code', code).maybeSingle()
    if (!clash) break
    code = generateCode()
  }

  const invited_name  = `${first_name.trim()} ${last_name.trim()}`
  const invited_email = email.trim().toLowerCase()
  const expiresAt     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({
      org_id:        org.id,
      code,
      role,
      invited_by:    user.id,
      expires_at:    expiresAt,
      invited_name,
      invited_email,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Envoyer l'email d'invitation (non-bloquant — l'invitation est créée même si l'email échoue)
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://auchu-os.vercel.app'
  const inviteUrl = `${appUrl}/invite/${code}`

  const emailSent = await sendInvitationEmail({
    to:         invited_email,
    toName:     invited_name,
    orgName:    org.name,
    role,
    inviteUrl,
  })

  return NextResponse.json({ data: invitation, email_sent: emailSent })
}
