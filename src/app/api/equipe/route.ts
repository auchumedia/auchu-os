import { createClient }        from '@/lib/supabase/server'
import { getOrgContext }       from '@/lib/org'
import { canManageRole }       from '@/lib/roles'
import { sendInvitationEmail } from '@/lib/email'
import { NextResponse }        from 'next/server'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org) return NextResponse.json({ error: 'Aucune organisation' }, { status: 404 })

  const body = await req.json()
  const { role, first_name, last_name, email } = body

  if (!canManageRole(ctx.role, role)) {
    return NextResponse.json({ error: 'Rôle invalide pour votre niveau d\'accès' }, { status: 400 })
  }
  if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Prénom, nom et email sont requis' }, { status: 400 })
  }

  // Un chef_equipe invite forcément dans sa propre équipe.
  let teamId: string | null = null
  if (ctx.isTeamChef) {
    if (!ctx.teamId) return NextResponse.json({ error: 'Vous ne dirigez aucune équipe' }, { status: 403 })
    teamId = ctx.teamId
  }

  const supabase = await createClient()

  const { count } = await supabase
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', ctx.org.id)
    .eq('status', 'actif')

  if ((count ?? 0) >= ctx.org.max_members) {
    return NextResponse.json(
      { error: `Limite atteinte pour le plan ${ctx.org.plan} (${ctx.org.max_members} membres max)` },
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
      org_id:        ctx.org.id,
      code,
      role,
      team_id:       teamId,
      invited_by:    ctx.userId,
      expires_at:    expiresAt,
      invited_name,
      invited_email,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Envoyer l'email d'invitation (non-bloquant — l'invitation est créée même si l'email échoue)
  const { data: orgBranding } = await supabase
    .from('organizations')
    .select('logo_url, primary_color')
    .eq('id', ctx.org.id)
    .single()

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://auchu-os.vercel.app'
  const inviteUrl = `${appUrl}/invite/${code}`

  const emailSent = await sendInvitationEmail({
    to:   invited_email,
    toName:           invited_name,
    orgName:          ctx.org.name,
    orgLogoUrl:       orgBranding?.logo_url ?? null,
    orgPrimaryColor:  orgBranding?.primary_color ?? '#4f46e5',
    role,
    inviteUrl,
  })

  return NextResponse.json({ data: invitation, email_sent: emailSent })
}
