import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { canAccessInsight } from '@/lib/roles'
import { INSIGHT_PLATFORMS, type InsightPlatform } from '@/lib/insights'
import { NextResponse } from 'next/server'

// Champs numériques "volume" — doivent être des entiers ≥ 0 quand fournis.
// followers_gained est à part : c'est un delta signé (une page peut perdre
// des abonnés un mois donné), jamais contraint au positif.
const NON_NEGATIVE_INT_FIELDS = [
  'followers', 'views', 'reach', 'likes', 'comments', 'shares', 'saves',
  'profile_visits', 'posts_published',
] as const

const TEXT_FIELDS = ['top_post_title', 'top_post_url', 'notes'] as const

// Toute la table est protégée par RLS (migration 054) : owner/director/
// stratège (scopé équipe) en lecture+écriture, monteur refusé par défaut.
// canAccessInsight() ici n'est qu'un filtre applicatif rapide (évite une
// requête pour un rôle qui n'y a de toute façon jamais accès) — l'autorité
// réelle reste la RLS, jamais dupliquée ici.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccessInsight(ctx.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_insights')
    .select('*')
    .eq('client_id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .order('month', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

function isPlainInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v)
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccessInsight(ctx.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { platform, month } = body as { platform?: string; month?: string }
  if (!platform || !INSIGHT_PLATFORMS.includes(platform as InsightPlatform)) {
    return NextResponse.json({ error: 'Plateforme invalide (instagram, facebook ou tiktok)' }, { status: 400 })
  }
  if (!month || !/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Mois invalide (attendu YYYY-MM-DD)' }, { status: 400 })
  }

  const row: Record<string, unknown> = {
    client_id: params.id,
    user_id: ctx.dataOwnerId,
    platform,
    month,
  }

  for (const field of NON_NEGATIVE_INT_FIELDS) {
    if (!(field in body)) continue
    const v = (body as Record<string, unknown>)[field]
    if (v === null || v === '') { row[field] = null; continue }
    if (!isPlainInteger(v) || v < 0) {
      return NextResponse.json({ error: `${field} doit être un nombre entier positif ou vide` }, { status: 400 })
    }
    row[field] = v
  }

  if ('followers_gained' in body) {
    const v = (body as Record<string, unknown>).followers_gained
    if (v === null || v === '') { row.followers_gained = null }
    else if (!isPlainInteger(v)) {
      return NextResponse.json({ error: 'followers_gained doit être un nombre entier (positif ou négatif) ou vide' }, { status: 400 })
    } else {
      row.followers_gained = v
    }
  }

  for (const field of TEXT_FIELDS) {
    if (!(field in body)) continue
    const v = (body as Record<string, unknown>)[field]
    row[field] = typeof v === 'string' && v.trim() !== '' ? v : null
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_insights')
    .upsert(row, { onConflict: 'client_id,platform,month' })
    .select()
    .single()

  if (error) {
    console.error(
      '[api/clients/insights POST] échec —',
      'client_id:', params.id, '| platform:', platform, '| month:', month,
      '| user:', ctx.userId, '| role:', ctx.role, '| dataOwnerId:', ctx.dataOwnerId,
      '| supabase error code:', error.code, '| message:', error.message,
    )
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details, hint: error.hint },
      { status: 500 }
    )
  }
  return NextResponse.json({ data })
}
