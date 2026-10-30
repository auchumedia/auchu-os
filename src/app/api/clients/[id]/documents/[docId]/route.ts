import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse } from 'next/server'

function canManage(ctx: { isOwner: boolean; isDirector: boolean }) {
  return ctx.isOwner || ctx.isDirector
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; docId: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(ctx)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('client_documents')
    .select('storage_path')
    .eq('id', params.docId)
    .eq('client_id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  await supabase.storage.from('client-documents').remove([doc.storage_path])

  const { error } = await supabase
    .from('client_documents')
    .delete()
    .eq('id', params.docId)
    .eq('user_id', ctx.dataOwnerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
