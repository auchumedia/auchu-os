import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the client belongs to this user
  const { data: existing, error: selectErr } = await supabase
    .from('clients')
    .select('id, portal_token, portal_enabled')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (selectErr || !existing) {
    console.error('[portal POST] select error:', selectErr)
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  // Reuse existing token or generate a new one
  const token = existing.portal_token ?? crypto.randomUUID()

  const { error: updateErr } = await supabase
    .from('clients')
    .update({ portal_token: token, portal_enabled: true })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (updateErr) {
    console.error('[portal POST] update error:', updateErr)
    return NextResponse.json(
      { error: `Impossible de créer le lien portail : ${updateErr.message}` },
      { status: 500 }
    )
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return NextResponse.json({ portal_url: `${base}/portail/${token}`, token })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('clients')
    .update({ portal_token: null, portal_enabled: false })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[portal DELETE] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
