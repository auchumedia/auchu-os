import { getOrgContext } from '@/lib/org'
import { createClient } from '@/lib/supabase/server'
import { canViewFinance } from '@/lib/roles'
import { exchangeCodeForTokens, currentEnvironment } from '@/lib/quickbooks/oauth'
import { saveTokens } from '@/lib/quickbooks/connection'
import { QUICKBOOKS_STATE_COOKIE } from '@/lib/quickbooks/config'
import { NextResponse, type NextRequest } from 'next/server'

function redirectToDashboard(req: NextRequest, status: string) {
  const url = new URL('/dashboard', req.nextUrl.origin)
  url.searchParams.set('quickbooks', status)
  const res = NextResponse.redirect(url)
  // Le cookie d'état a fait son travail (succès ou non) — on le nettoie
  // systématiquement, jamais réutilisable.
  res.cookies.set(QUICKBOOKS_STATE_COOKIE, '', { path: '/api/quickbooks', maxAge: 0 })
  return res
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code    = searchParams.get('code')
  const state   = searchParams.get('state')
  const realmId = searchParams.get('realmId')
  const oauthError = searchParams.get('error')

  // Intuit renvoie ?error=... si l'utilisateur refuse le consentement.
  if (oauthError) return redirectToDashboard(req, 'cancelled')

  // ── Protection CSRF — le state renvoyé par Intuit doit correspondre
  //    exactement au cookie httpOnly posé par /api/quickbooks/connect. ──────
  const cookieState = req.cookies.get(QUICKBOOKS_STATE_COOKIE)?.value
  if (!state || !cookieState || state !== cookieState) {
    console.error('[quickbooks/callback] state CSRF invalide — cookie:', !!cookieState, '| query:', !!state)
    return redirectToDashboard(req, 'state_mismatch')
  }

  if (!code || !realmId) {
    return redirectToDashboard(req, 'error')
  }

  const ctx = await getOrgContext()
  if (!ctx || !canViewFinance(ctx.role)) {
    return redirectToDashboard(req, 'error')
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const supabase = await createClient()
    await saveTokens(supabase, ctx.dataOwnerId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      realmId,
      environment: currentEnvironment(),
      companyName: null, // renseigné au prochain appel de /api/quickbooks/status
    })
  } catch (e) {
    console.error('[quickbooks/callback] échange du code échoué —', e instanceof Error ? e.message : e)
    return redirectToDashboard(req, 'error')
  }

  return redirectToDashboard(req, 'connected')
}
