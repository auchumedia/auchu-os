import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // Verify the client belongs to this org — clients.user_id est l'ID du
  // owner, pas celui de la personne qui clique (même bug que
  // /api/clients/[id], jamais corrigé sur cette route jusqu'ici). Filtrer sur
  // user.id ici faisait échouer ce SELECT pour tout non-owner : 0 ligne
  // trouvée → .single() lève PGRST116 "Cannot coerce the result to a single
  // JSON object", visible dans "Générer un lien portail" en haut de la fiche
  // client, sur n'importe quel onglet.
  const { data: existing, error: selectErr } = await supabase
    .from('clients')
    .select('id, portal_token, portal_enabled')
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .maybeSingle()

  if (selectErr) {
    console.error('[portal POST] select error:', selectErr.code, selectErr.message)
    return NextResponse.json({ error: selectErr.message }, { status: 500 })
  }
  if (!existing) {
    console.error('[portal POST] client introuvable —', 'client_id:', params.id, '| user:', ctx.userId, '| role:', ctx.role, '| dataOwnerId:', ctx.dataOwnerId)
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  // Reuse existing token or generate a new one
  const token = existing.portal_token ?? crypto.randomUUID()

  const { error: updateErr } = await supabase
    .from('clients')
    .update({ portal_token: token, portal_enabled: true })
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)

  if (updateErr) {
    console.error('[portal POST] update error:', updateErr)
    return NextResponse.json(
      { error: `Impossible de créer le lien portail : ${updateErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ token })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('clients')
    .update({ portal_token: null, portal_enabled: false })
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)

  if (error) {
    console.error('[portal DELETE] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
