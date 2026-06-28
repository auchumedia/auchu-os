import { createAnonClient } from '@/lib/supabase/anon'
import { NextResponse } from 'next/server'

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
      { status: 403 }
    )
  }

  console.log('[portail/contenu] client found:', client.id, client.name)

  // Step 2 — fetch content_pieces as anon
  const { data, error, count } = await supabase
    .from('content_pieces')
    .select('*', { count: 'exact' })
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[portail/contenu] content_pieces error:', error)
    return NextResponse.json(
      { error: error.message, code: error.code, hint: error.hint, details: error.details },
      { status: 500 }
    )
  }

  console.log('[portail/contenu] rows returned:', count)

  return NextResponse.json({ data: data ?? [], count, client_id: client.id })
}
