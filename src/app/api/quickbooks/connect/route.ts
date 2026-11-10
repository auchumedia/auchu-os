import { getOrgContext } from '@/lib/org'
import { canManageQuickBooksConnection } from '@/lib/roles'
import { buildAuthorizationUrl, generateState } from '@/lib/quickbooks/oauth'
import { QUICKBOOKS_STATE_COOKIE, QUICKBOOKS_STATE_COOKIE_MAX_AGE } from '@/lib/quickbooks/config'
import { NextResponse } from 'next/server'

// Connecter QuickBooks = lier le compte Intuit du propriétaire — réservé au
// propriétaire (director/stratege/monteur voient le statut et synchronisent
// via canViewFinance, mais ne peuvent pas créer/révoquer la connexion).
export async function GET() {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_APP_URL))
  if (!canManageQuickBooksConnection(ctx.role)) {
    return NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL))
  }

  const state = generateState()
  const authUrl = await buildAuthorizationUrl(state)

  const res = NextResponse.redirect(authUrl)
  res.cookies.set(QUICKBOOKS_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: QUICKBOOKS_STATE_COOKIE_MAX_AGE,
    path: '/api/quickbooks',
  })
  return res
}
