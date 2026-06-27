import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

  const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${user.id}/${params.id}.${ext}`

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const { error: uploadError } = await supabase.storage
    .from('client-logos')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from('client-logos')
    .getPublicUrl(path)

  // Append cache-buster so the browser always fetches the new image
  const logo_url = `${publicUrl}?v=${Date.now()}`

  await supabase
    .from('clients')
    .update({ logo_url })
    .eq('id', params.id)
    .eq('user_id', user.id)

  return NextResponse.json({ logo_url })
}
