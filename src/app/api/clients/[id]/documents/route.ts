import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse } from 'next/server'

const MAX_DOCUMENTS = 10
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 Mo

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
    .from('client_documents')
    .select('*')
    .eq('client_id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bucket privé — chaque document a besoin d'une signed URL fraîche pour être
  // téléchargeable, générée à la demande plutôt que stockée en clair.
  const withUrls = await Promise.all((data ?? []).map(async doc => {
    const { data: signed } = await supabase.storage
      .from('client-documents')
      .createSignedUrl(doc.storage_path, 3600)
    return { ...doc, url: signed?.signedUrl ?? null }
  }))

  return NextResponse.json({ data: withUrls })
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const supabase = await createClient()

  const { count } = await supabase
    .from('client_documents')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', params.id)
    .eq('user_id', ctx.dataOwnerId)

  if ((count ?? 0) >= MAX_DOCUMENTS) {
    return NextResponse.json({ error: `Limite de ${MAX_DOCUMENTS} documents atteinte` }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Seuls les fichiers PDF sont acceptés' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo)' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^\w.\-]/g, '_')
  const path = `${ctx.dataOwnerId}/${params.id}/${Date.now()}_${safeName}`

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const { error: uploadError } = await supabase.storage
    .from('client-documents')
    .upload(path, buffer, { contentType: file.type })

  if (uploadError) {
    console.error(
      '[api/clients/documents POST] échec upload storage —',
      'client_id:', params.id, '| path:', path,
      '| user:', ctx.userId, '| role:', ctx.role, '| dataOwnerId:', ctx.dataOwnerId,
      '| error:', uploadError.message,
    )
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('client_documents')
    .insert({
      client_id:    params.id,
      user_id:      ctx.dataOwnerId,
      name:         file.name,
      storage_path: path,
      file_size:    file.size,
      uploaded_by:  ctx.userId,
    })
    .select()
    .single()

  if (error) {
    console.error(
      '[api/clients/documents POST] échec insert DB —',
      'client_id:', params.id, '| path:', path,
      '| supabase error code:', error.code, '| message:', error.message,
      '| details:', error.details, '| hint:', error.hint,
    )
    await supabase.storage.from('client-documents').remove([path])
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details, hint: error.hint },
      { status: 500 }
    )
  }
  return NextResponse.json({ data }, { status: 201 })
}
