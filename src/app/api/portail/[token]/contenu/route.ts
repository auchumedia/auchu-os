import { createAnonClient } from '@/lib/supabase/anon'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const supabase = createAnonClient()

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('portal_token', params.token)
    .eq('portal_enabled', true)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Portail invalide' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('content_pieces')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
