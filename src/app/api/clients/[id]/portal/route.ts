import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await supabase
    .from('clients')
    .select('portal_token, portal_enabled')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  let token = client.portal_token
  if (!token) {
    token = crypto.randomUUID()
    await supabase
      .from('clients')
      .update({ portal_token: token, portal_enabled: true })
      .eq('id', params.id)
      .eq('user_id', user.id)
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

  await supabase
    .from('clients')
    .update({ portal_token: null, portal_enabled: false })
    .eq('id', params.id)
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
