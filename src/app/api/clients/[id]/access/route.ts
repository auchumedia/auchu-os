import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse } from 'next/server'

const ALLOWED_FIELDS = [
  'instagram_email', 'instagram_password',
  'facebook_email',  'facebook_password',
  'tiktok_email',    'tiktok_password',
  'linkedin_email',  'linkedin_password',
  'notes',
]

function canManage(ctx: { isOwner: boolean; isDirector: boolean }) {
  return ctx.isOwner || ctx.isDirector
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_platform_access')
    .select('*')
    .eq('client_id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const supabase = await createClient()
  const body = await req.json()

  const fields: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) fields[key] = body[key]
  }

  const { data, error } = await supabase
    .from('client_platform_access')
    .upsert(
      { client_id: params.id, user_id: ctx.dataOwnerId, ...fields },
      { onConflict: 'client_id' }
    )
    .select()
    .single()

  if (error) {
    console.error(
      '[api/clients/access PATCH] échec —',
      'client_id:', params.id,
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
