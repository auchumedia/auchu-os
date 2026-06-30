import { createServerClient }            from '@supabase/ssr'
import { createClient as createAnonSupa } from '@supabase/supabase-js'
import { cookies }                        from 'next/headers'
import { NextResponse }                   from 'next/server'
import type { NextRequest }               from 'next/server'
import type { SupabaseClient }            from '@supabase/supabase-js'

const OWNER_EMAIL = 'raphael@auchumedia.com'

// Callback dédié aux invitations.
// emailRedirectTo dans signUp = /auth/callback/[CODE]
// → Supabase ajoute ?code=xxx → /auth/callback/U6VP3B?code=xxx
// Le code d'invitation est dans le PATH (robuste) et non dans les query params
// (que Supabase peut perdre selon la version GoTrue).
export async function GET(
  request: NextRequest,
  { params }: { params: { inviteCode: string } }
) {
  const { searchParams, origin } = new URL(request.url)
  const pkceCode   = searchParams.get('code')
  const inviteCode = params.inviteCode.toUpperCase().trim()

  console.log('[invite-cb] ── inviteCode:', inviteCode, '| pkce:', pkceCode ? pkceCode.slice(0, 12) + '…' : 'ABSENT')

  if (!pkceCode) {
    console.warn('[invite-cb] pas de code PKCE dans URL → retour page invite')
    return NextResponse.redirect(`${origin}/invite/${inviteCode}`)
  }

  // ── 1. Créer le client avec gestion des cookies ────────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // ── 2. Échanger le code PKCE (single-use) → session établie ───────────────
  const { error: exchErr } = await supabase.auth.exchangeCodeForSession(pkceCode)
  if (exchErr) {
    console.error('[invite-cb] exchangeCodeForSession ERREUR:', exchErr.message)
    return NextResponse.redirect(`${origin}/invite/${inviteCode}?error=session_failed`)
  }
  console.log('[invite-cb] session établie')

  // ── 3. Récupérer l'utilisateur (session fraîchement créée) ─────────────────
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) {
    console.error('[invite-cb] getUser ERREUR:', userErr?.message ?? 'null')
    return NextResponse.redirect(`${origin}/invite/${inviteCode}?error=no_user`)
  }
  console.log('[invite-cb] user:', user.id, '|', user.email)

  // ── 4. Rejoindre l'organisation ────────────────────────────────────────────
  const joined = await joinOrgByCode(supabase, inviteCode, user.id, user.email ?? '')

  if (joined) {
    console.log('[invite-cb] ✓ membre ajouté → /dashboard')
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // Si le join échoue, retourner sur la page invite (l'utilisateur est connecté,
  // il verra le bouton "Rejoindre" et pourra réessayer manuellement).
  console.warn('[invite-cb] join échoué → retour /invite/' + inviteCode)
  return NextResponse.redirect(`${origin}/invite/${inviteCode}`)
}

// ─── Logique de join ──────────────────────────────────────────────────────────

async function joinOrgByCode(
  supabase: SupabaseClient,
  code: string,
  userId: string,
  userEmail: string,
): Promise<boolean> {
  const now = new Date().toISOString()

  // ── a. Lire l'invitation ───────────────────────────────────────────────────
  const { data: inv, error: invErr } = await supabase
    .from('invitations')
    .select('id, org_id, role, expires_at')
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', now)
    .maybeSingle()

  console.log('[invite-cb/join] invitation →',
    invErr ? `ERREUR ${invErr.code}: ${invErr.message}` : JSON.stringify(inv))

  if (invErr || !inv) {
    console.warn('[invite-cb/join] invitation introuvable, expirée ou déjà utilisée')
    return false
  }

  // ── b. Déjà membre ? ── retourner true pour ne pas bloquer l'accès ─────────
  const { data: existing, error: existErr } = await supabase
    .from('org_members')
    .select('id')
    .eq('org_id', inv.org_id)
    .eq('user_id', userId)
    .maybeSingle()

  console.log('[invite-cb/join] déjà membre →',
    existErr ? `ERREUR: ${existErr.message}` : JSON.stringify(existing))

  if (existing) {
    console.log('[invite-cb/join] déjà membre → succès direct')
    return true
  }

  // ── c. Lire l'org via client anon (invité pas encore membre) ──────────────
  const anon = createAnonSupa(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: org, error: orgErr } = await anon
    .from('organizations')
    .select('id, name, max_members, plan')
    .eq('id', inv.org_id)
    .maybeSingle()

  console.log('[invite-cb/join] org (anon) →',
    orgErr ? `ERREUR ${orgErr.code}: ${orgErr.message}` : JSON.stringify(org))

  if (!org) {
    console.warn('[invite-cb/join] org introuvable — migration 016 appliquée ?')
    return false
  }

  // ── d. Vérifier la limite de membres ──────────────────────────────────────
  const effectiveMax = userEmail === OWNER_EMAIL ? 999 : org.max_members
  const { count, error: countErr } = await supabase
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', inv.org_id)
    .eq('status', 'actif')

  console.log('[invite-cb/join] membres actifs →',
    countErr ? `ERREUR: ${countErr.message}` : `${count} / ${effectiveMax}`)

  if ((count ?? 0) >= effectiveMax) {
    console.warn('[invite-cb/join] limite de membres atteinte')
    return false
  }

  // ── e. INSERT org_members ─────────────────────────────────────────────────
  const payload = { org_id: inv.org_id, user_id: userId, role: inv.role, status: 'actif' }
  console.log('[invite-cb/join] INSERT org_members:', JSON.stringify(payload))

  const { data: inserted, error: joinErr } = await supabase
    .from('org_members')
    .insert(payload)
    .select('id')
    .maybeSingle()

  if (joinErr) {
    console.error('[invite-cb/join] INSERT ÉCHOUÉ →',
      `code=${joinErr.code} msg=${joinErr.message} details=${joinErr.details} hint=${joinErr.hint}`)
    return false
  }
  console.log('[invite-cb/join] INSERT OK → id:', inserted?.id)

  // ── f. Marquer l'invitation utilisée ─────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('invitations')
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq('id', inv.id)

  console.log('[invite-cb/join] update used_at →', updateErr ? `ERREUR: ${updateErr.message}` : 'OK')

  return true
}
