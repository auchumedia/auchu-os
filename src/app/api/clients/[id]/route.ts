import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()

  // clients.user_id est l'ID du owner de l'org, pas celui de la personne qui
  // édite — même bug que content_pieces (cf. historique de cette route),
  // corrigé ici de la même façon.
  const { data, error } = await supabase
    .from('clients')
    .update(body)
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .select('*')
    .single()

  if (error) {
    console.error(
      '[api/clients PATCH] échec —',
      'client_id:', params.id,
      '| fields:', Object.keys(body),
      '| user:', ctx.userId, '| role:', ctx.role, '| dataOwnerId:', ctx.dataOwnerId,
      '| supabase error code:', error.code,
      '| message:', error.message,
      '| details:', error.details,
      '| hint:', error.hint,
    )
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details, hint: error.hint },
      { status: 500 }
    )
  }
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
