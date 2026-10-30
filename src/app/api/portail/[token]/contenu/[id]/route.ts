import { createAnonClient } from '@/lib/supabase/anon'
import { NextResponse } from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: { token: string; id: string } }
) {
  const supabase = createAnonClient()

  // Verify the token belongs to a portal-enabled client
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('portal_token', params.token)
    .eq('portal_enabled', true)
    .single()

  if (!client) return NextResponse.json({ error: 'Portail invalide' }, { status: 403 })

  const body = await req.json()

  // Only allow updating client_notes and status (approve/refuse)
  const fields: Record<string, unknown> = {}
  if ('client_notes' in body) fields.client_notes = body.client_notes
  if ('status' in body && ['approuve', 'refuse'].includes(body.status)) {
    fields.status = body.status
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Aucun champ valide' }, { status: 400 })
  }

  // Colonnes explicites — jamais select() nu : la réponse est renvoyée au
  // navigateur du client, internal_notes et assigned_to ne doivent jamais y
  // figurer (cf. /api/portail/[token]/contenu/route.ts).
  const { data, error } = await supabase
    .from('content_pieces')
    .update(fields)
    .eq('id', params.id)
    .eq('client_id', client.id)
    .select('id, client_id, user_id, project_id, title, type, platform, status, body, description, script, client_notes, reference_links, position, scheduled_at, month_target, published_at, ai_generated, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
