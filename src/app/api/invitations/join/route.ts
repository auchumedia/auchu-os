import { createClient }     from '@/lib/supabase/server'
import { createAnonClient }  from '@/lib/supabase/anon'
import { NextResponse }      from 'next/server'

const OWNER_EMAIL = 'raphael@auchumedia.com'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  console.log('[join] user:', user?.id ?? 'null', '| email:', user?.email ?? 'null')

  if (!user) return NextResponse.json({ error: 'Non authentifié — confirme ton email puis réessaie' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code requis' }, { status: 400 })

  const normalizedCode = code.toUpperCase().trim()
  console.log('[join] code:', normalizedCode)

  // ── 1. Lire l'invitation seule (pas de join org — le invitee n'est pas encore membre) ──
  const { data: inv, error: invErr } = await supabase
    .from('invitations')
    .select('id, org_id, role, expires_at')
    .eq('code', normalizedCode)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  console.log('[join] inv:', JSON.stringify(inv), '| invErr:', JSON.stringify(invErr))

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })
  if (!inv)   return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 400 })

  // ── 2. Lire l'org via client anon (policy "org: anon read via invitation") ─────────────
  const anon = createAnonClient()
  const { data: org, error: orgErr } = await anon
    .from('organizations')
    .select('id, name, max_members, plan')
    .eq('id', inv.org_id)
    .maybeSingle()

  console.log('[join] org:', JSON.stringify(org), '| orgErr:', JSON.stringify(orgErr))

  if (!org) return NextResponse.json({ error: 'Organisation introuvable' }, { status: 400 })

  // ── 3. Déjà membre ? ──────────────────────────────────────────────────────────────────
  const { data: alreadyMember } = await supabase
    .from('org_members')
    .select('id')
    .eq('org_id', inv.org_id)
    .eq('user_id', user.id)
    .maybeSingle()

  console.log('[join] alreadyMember:', JSON.stringify(alreadyMember))

  if (alreadyMember) {
    console.log('[join] déjà membre → succès direct')
    return NextResponse.json({ success: true, org_name: org.name })
  }

  // ── 4. Vérifier la limite de membres ─────────────────────────────────────────────────
  const effectiveMax = user.email === OWNER_EMAIL ? 999 : org.max_members
  const { count } = await supabase
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', inv.org_id)
    .eq('status', 'actif')

  console.log('[join] membres actifs:', count, '| limite:', effectiveMax)

  if ((count ?? 0) >= effectiveMax) {
    return NextResponse.json(
      { error: `Cette équipe a atteint sa limite de membres (plan ${org.plan})` },
      { status: 403 }
    )
  }

  // ── 5. Rejoindre l'org ────────────────────────────────────────────────────────────────
  const { error: joinErr } = await supabase.from('org_members').insert({
    org_id: inv.org_id, user_id: user.id, role: inv.role, status: 'actif',
  })

  console.log('[join] insert org_members:', joinErr ? joinErr.message : 'OK')

  if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 500 })

  // ── 6. Marquer l'invitation utilisée ──────────────────────────────────────────────────
  await supabase.from('invitations')
    .update({ used_at: new Date().toISOString(), used_by: user.id })
    .eq('id', inv.id)

  console.log('[join] invitation marquée utilisée → succès')
  return NextResponse.json({ success: true, org_name: org.name })
}
