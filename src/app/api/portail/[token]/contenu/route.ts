import { createAnonClient } from '@/lib/supabase/anon'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const supabase = createAnonClient()

  // Step 1 — resolve token → client_id
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, portal_enabled, portal_token')
    .eq('portal_token', params.token)
    .eq('portal_enabled', true)
    .single()

  if (clientErr || !client) {
    console.error('[portail/contenu] client lookup failed:', clientErr?.message, '| token:', params.token)
    return NextResponse.json(
      { error: 'Portail invalide', detail: clientErr?.message ?? 'no client found', token: params.token },
      { status: 403, headers: NO_CACHE }
    )
  }

  console.log('[portail/contenu] client found:', client.id, client.name)

  // Step 2 — fetch content_pieces as anon (explicit columns so nothing is ever omitted)
  const { data, error, count } = await supabase
    .from('content_pieces')
    .select('id, client_id, user_id, project_id, title, type, platform, status, body, description, script, assigned_to, client_notes, reference_links, position, scheduled_at, published_at, ai_generated, created_at, updated_at', { count: 'exact' })
    .eq('client_id', client.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[portail/contenu] content_pieces error:', error)
    return NextResponse.json(
      { error: error.message, code: error.code, hint: error.hint, details: error.details },
      { status: 500, headers: NO_CACHE }
    )
  }

  console.log('[portail/contenu] rows returned:', count)

  return NextResponse.json({ data: data ?? [], count, client_id: client.id }, { headers: NO_CACHE })
}
