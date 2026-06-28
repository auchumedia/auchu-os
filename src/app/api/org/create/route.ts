import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  // Idempotent — si l'org existe déjà, retourner la même
  const { data: existing } = await supabase
    .from('organizations')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (existing) return NextResponse.json({ data: existing })

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({ name: name.trim(), owner_id: user.id, plan: 'free', max_members: 1 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Ajouter le propriétaire comme membre
  await supabase.from('org_members').insert({
    org_id: org.id, user_id: user.id, role: 'owner', status: 'actif',
  })

  return NextResponse.json({ data: org })
}
