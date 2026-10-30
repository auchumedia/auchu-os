import { createServerClient } from '@supabase/ssr'
import { cookies }            from 'next/headers'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

// Callback générique : password reset, magic link, etc.
// Les invitations utilisent /auth/callback/[inviteCode]/route.ts
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('[callback] code:', code ? code.slice(0, 12) + '…' : 'ABSENT', '| next:', next)

  if (!code) {
    console.log('[callback] pas de code PKCE → redirect login')
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

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(`${origin}/auth/login?error=confirmation_failed`)
  }

  console.log('[callback] session établie → redirect', next)
  return NextResponse.redirect(`${origin}${next}`)
}
