import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { full_name, avatar_url, title } = await req.json()

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name:  full_name?.trim()  || null,
      avatar_url: avatar_url         || null,
      title:      title?.trim()      || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
