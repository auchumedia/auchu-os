import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Vérifier que l'appelant est bien le propriétaire de l'org
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Supprimer seulement si l'invitation appartient à l'org et n'est pas encore utilisée
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', params.id)
    .eq('org_id', org.id)
    .is('used_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
