import { createClient } from '@supabase/supabase-js'
import { NextResponse }  from 'next/server'

// Route de debug — client anon brut, pas de session, pas de cookies.
// GET /api/invitations/[code]
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const code = params.code.toUpperCase().trim()
  const now  = new Date().toISOString()

  // 1. Cherche l'invitation sans aucun filtre RLS (juste le code)
  const { data: raw, error: rawErr } = await anon
    .from('invitations')
    .select('id, code, role, used_at, expires_at, invited_name, invited_email, org_id')
    .eq('code', code)
    .maybeSingle()

  // 2. Même requête avec les filtres used_at + expires_at
  const { data: filtered, error: filteredErr } = await anon
    .from('invitations')
    .select('id, code, role, used_at, expires_at, org_id')
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', now)
    .maybeSingle()

  return NextResponse.json({
    debug: {
      code_searched: code,
      now,
    },
    query_without_filters: { data: raw,      error: rawErr      },
    query_with_filters:    { data: filtered, error: filteredErr },
  })
}
