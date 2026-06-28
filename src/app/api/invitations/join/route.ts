import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code requis' }, { status: 400 })

  const { data: inv, error: invErr } = await supabase
    .from('invitations')
    .select('id, org_id, role, expires_at, org:organizations(id, name, max_members, plan)')
    .eq('code', code.toUpperCase().trim())
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (invErr || !inv) return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 400 })

  const org = inv.org as unknown as { id: string; name: string; max_members: number; plan: string }

  // Vérifier si le user est déjà dans l'org
  const { data: alreadyMember } = await supabase
    .from('org_members')
    .select('id')
    .eq('org_id', inv.org_id)
    .eq('user_id', user.id)
    .single()

  if (alreadyMember) return NextResponse.json({ success: true, org_name: org.name })

  // Vérifier la limite de membres
  const { count } = await supabase
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', inv.org_id)
    .eq('status', 'actif')

  if ((count ?? 0) >= org.max_members) {
    return NextResponse.json(
      { error: `Cette équipe a atteint sa limite de membres (plan ${org.plan})` },
      { status: 403 }
    )
  }

  // Rejoindre l'org
  const { error: joinErr } = await supabase.from('org_members').insert({
    org_id: inv.org_id, user_id: user.id, role: inv.role, status: 'actif',
  })

  if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 500 })

  // Marquer l'invitation comme utilisée
  await supabase.from('invitations')
    .update({ used_at: new Date().toISOString(), used_by: user.id })
    .eq('id', inv.id)

  return NextResponse.json({ success: true, org_name: org.name })
}
