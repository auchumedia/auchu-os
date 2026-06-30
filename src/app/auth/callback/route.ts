import { createServerClient }            from '@supabase/ssr'
import { createClient as createAnonSupa } from '@supabase/supabase-js'
import { cookies }                        from 'next/headers'
import { NextResponse }                   from 'next/server'
import type { NextRequest }               from 'next/server'
import type { SupabaseClient }            from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const next       = searchParams.get('next') ?? '/dashboard'
  const inviteCode = searchParams.get('invite')?.toUpperCase().trim() ?? null

  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (inviteCode) {
        console.log('[callback] invite détecté dans URL:', inviteCode)
        await autoJoinOrg(supabase, inviteCode)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[callback] exchangeCodeForSession error:', error.message)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=confirmation_failed`)
}

async function autoJoinOrg(supabase: SupabaseClient, code: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { console.log('[callback/join] pas de user après exchange'); return }

  console.log('[callback/join] user:', user.id, '| code:', code)

  // ── 1. Lire l'invitation ───────────────────────────────────────────────────
  const { data: inv, error: invErr } = await supabase
    .from('invitations')
    .select('id, org_id, role, expires_at')
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  console.log('[callback/join] inv:', JSON.stringify(inv), '| invErr:', JSON.stringify(invErr))
  if (!inv) { console.log('[callback/join] invitation invalide ou expirée'); return }

  // ── 2. Déjà membre ? ───────────────────────────────────────────────────────
  const { data: alreadyMember } = await supabase
    .from('org_members')
    .select('id')
    .eq('org_id', inv.org_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (alreadyMember) { console.log('[callback/join] déjà membre → skip'); return }

  // ── 3. Lire org via anon (policy "org: anon read via invitation" mig 016) ──
  const anon = createAnonSupa(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: org } = await anon
    .from('organizations')
    .select('id, max_members, plan')
    .eq('id', inv.org_id)
    .maybeSingle()

  console.log('[callback/join] org:', JSON.stringify(org))
  if (!org) { console.log('[callback/join] org introuvable'); return }

  // ── 4. Vérifier limite membres ─────────────────────────────────────────────
  const { count } = await supabase
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', inv.org_id)
    .eq('status', 'actif')

  console.log('[callback/join] membres actifs:', count, '| max:', org.max_members)
  if ((count ?? 0) >= org.max_members) { console.log('[callback/join] limite atteinte'); return }

  // ── 5. Insérer membre (nécessite migration 017 pour la policy RLS) ─────────
  const { error: joinErr } = await supabase.from('org_members').insert({
    org_id: inv.org_id, user_id: user.id, role: inv.role, status: 'actif',
  })

  console.log('[callback/join] insert org_members:', joinErr ? joinErr.message : 'OK')
  if (joinErr) return

  // ── 6. Marquer invitation utilisée ────────────────────────────────────────
  await supabase.from('invitations')
    .update({ used_at: new Date().toISOString(), used_by: user.id })
    .eq('id', inv.id)

  console.log('[callback/join] succès — membre ajouté et invitation marquée utilisée')
}
