import { createServerClient }            from '@supabase/ssr'
import { createClient as createAnonSupa } from '@supabase/supabase-js'
import { cookies }                        from 'next/headers'
import { NextResponse }                   from 'next/server'
import type { NextRequest }               from 'next/server'
import type { SupabaseClient }            from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const fullUrl    = request.url
  const { searchParams, origin } = new URL(fullUrl)
  const code       = searchParams.get('code')
  const next       = searchParams.get('next') ?? '/dashboard'
  const inviteCode = searchParams.get('invite')?.toUpperCase().trim() ?? null

  console.log('[callback] URL reçue:', fullUrl)
  console.log('[callback] code:', code ? code.slice(0, 12) + '…' : 'ABSENT')
  console.log('[callback] invite:', inviteCode ?? 'ABSENT')
  console.log('[callback] next:', next)

  if (!code) {
    console.log('[callback] aucun code PKCE dans URL → redirect login')
    return NextResponse.redirect(`${origin}/auth/login?error=confirmation_failed`)
  }

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

  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
  console.log('[callback] exchangeCodeForSession →', sessionError
    ? `ERREUR: ${sessionError.message}`
    : `OK — user: ${sessionData.user?.id ?? 'null'}`)

  if (sessionError) {
    return NextResponse.redirect(`${origin}/auth/login?error=confirmation_failed`)
  }

  if (inviteCode) {
    await autoJoinOrg(supabase, inviteCode)
  } else {
    console.log('[callback] pas de code invitation → join ignoré')
  }

  return NextResponse.redirect(`${origin}${next}`)
}

async function autoJoinOrg(supabase: SupabaseClient, code: string): Promise<void> {
  console.log('[callback/join] ── début autoJoinOrg, code:', code)

  // ── 0. User ───────────────────────────────────────────────────────────────
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  console.log('[callback/join] getUser →', userErr
    ? `ERREUR: ${userErr.message}`
    : `user: ${user?.id ?? 'null'} (${user?.email ?? '—'})`)
  if (!user) return

  // ── 1. Invitation ─────────────────────────────────────────────────────────
  const now = new Date().toISOString()
  const { data: inv, error: invErr } = await supabase
    .from('invitations')
    .select('id, org_id, role, expires_at, used_at')
    .eq('code', code)
    .maybeSingle()

  console.log('[callback/join] invitation (sans filtres) →',
    invErr
      ? `ERREUR code=${invErr.code} msg=${invErr.message} details=${invErr.details} hint=${invErr.hint}`
      : JSON.stringify(inv))

  if (invErr || !inv) {
    console.log('[callback/join] invitation introuvable → abandon')
    return
  }

  if (inv.used_at) {
    console.log('[callback/join] invitation déjà utilisée (used_at:', inv.used_at, ') → abandon')
    return
  }

  if (inv.expires_at < now) {
    console.log('[callback/join] invitation expirée (expires_at:', inv.expires_at, ', now:', now, ') → abandon')
    return
  }

  console.log('[callback/join] invitation valide — org_id:', inv.org_id, '| role:', inv.role)

  // ── 2. Déjà membre ? ──────────────────────────────────────────────────────
  const { data: alreadyMember, error: memberCheckErr } = await supabase
    .from('org_members')
    .select('id')
    .eq('org_id', inv.org_id)
    .eq('user_id', user.id)
    .maybeSingle()

  console.log('[callback/join] déjà membre →',
    memberCheckErr ? `ERREUR: ${memberCheckErr.message}` : JSON.stringify(alreadyMember))

  if (alreadyMember) {
    console.log('[callback/join] déjà membre → skip insert')
    return
  }

  // ── 3. Org via client anon (policy mig 016) ───────────────────────────────
  const anon = createAnonSupa(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: org, error: orgErr } = await anon
    .from('organizations')
    .select('id, name, max_members, plan')
    .eq('id', inv.org_id)
    .maybeSingle()

  console.log('[callback/join] org (anon) →',
    orgErr
      ? `ERREUR code=${orgErr.code} msg=${orgErr.message} details=${orgErr.details} hint=${orgErr.hint}`
      : JSON.stringify(org))

  if (!org) {
    console.log('[callback/join] org introuvable → abandon (migration 016 appliquée ?)')
    return
  }

  // ── 4. Limite membres ─────────────────────────────────────────────────────
  const { count, error: countErr } = await supabase
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', inv.org_id)
    .eq('status', 'actif')

  console.log('[callback/join] count membres actifs →',
    countErr ? `ERREUR: ${countErr.message}` : count, '| max:', org.max_members)

  if ((count ?? 0) >= org.max_members) {
    console.log('[callback/join] limite de membres atteinte → abandon')
    return
  }

  // ── 5. INSERT org_members ──────────────────────────────────────────────────
  const insertPayload = { org_id: inv.org_id, user_id: user.id, role: inv.role, status: 'actif' }
  console.log('[callback/join] INSERT org_members payload:', JSON.stringify(insertPayload))

  const { data: insertData, error: joinErr } = await supabase
    .from('org_members')
    .insert(insertPayload)
    .select()

  if (joinErr) {
    console.log('[callback/join] INSERT ÉCHOUÉ →',
      `code=${joinErr.code} msg=${joinErr.message} details=${joinErr.details} hint=${joinErr.hint}`)
    return
  }

  console.log('[callback/join] INSERT réussi →', JSON.stringify(insertData))

  // ── 6. Marquer invitation utilisée ────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('invitations')
    .update({ used_at: new Date().toISOString(), used_by: user.id })
    .eq('id', inv.id)

  console.log('[callback/join] update invitation used_at →',
    updateErr ? `ERREUR: ${updateErr.message}` : 'OK')

  console.log('[callback/join] ── autoJoinOrg terminé avec succès')
}
