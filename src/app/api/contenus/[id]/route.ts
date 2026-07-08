import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse } from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()

  const allowed = ['title','type','platform','status','description','script','assigned_to','client_notes','scheduled_at','reference_links','position']
  const fields: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) fields[key] = body[key]
  }

  console.log(
    '[api/contenus PATCH] tentative —',
    'content_id:', params.id,
    '| fields:', Object.keys(fields),
    '| auth.uid():', ctx.userId,
    '| role:', ctx.role,
    '| isOwner:', ctx.isOwner,
    '| dataOwnerId (filtre user_id):', ctx.dataOwnerId,
  )

  // content_pieces.user_id est toujours l'ID du owner de l'org (cf. page.tsx),
  // pas celui de la personne qui édite — filtrer sur user.id cassait le PATCH
  // pour tout membre d'équipe non-owner (0 ligne trouvée → PGRST116 → 500,
  // alors que le statut restait affiché côté client sans rollback).
  const { data, error } = await supabase
    .from('content_pieces')
    .update(fields)
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .select()
    .single()

  console.log(
    '[api/contenus PATCH] résultat supabase —',
    'content_id:', params.id,
    '| user:', ctx.userId, '| role:', ctx.role, '| dataOwnerId:', ctx.dataOwnerId,
    '| data:', data ? { id: data.id, user_id: data.user_id, script_len: typeof data.script === 'string' ? data.script.length : null } : null,
    '| error:', error,
  )

  if (error) {
    console.error(
      '[api/contenus PATCH] échec —',
      'content_id:', params.id,
      '| fields:', Object.keys(fields),
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
    .from('content_pieces')
    .delete()
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
