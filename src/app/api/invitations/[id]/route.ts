import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const supabase = await createClient()

  // Supprimer seulement si l'invitation appartient à l'org et n'est pas encore
  // utilisée — la policy "invitations: hierarchy delete" (owner/director org-
  // wide, chef_equipe sur sa propre équipe) fait le vrai contrôle d'accès.
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', params.id)
    .eq('org_id', ctx.org.id)
    .is('used_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
