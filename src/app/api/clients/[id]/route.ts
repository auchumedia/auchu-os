import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  // maybeSingle() plutôt que single() : si le filtre user_id/id ne matche
  // aucune ligne (mauvais rôle, client d'une autre org…), on veut un 404
  // propre — single() lève PGRST116 ("Cannot coerce the result to a single
  // JSON object") dans ce cas, un message cryptique côté client.
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const body = await req.json()

  // clients.user_id est l'ID du owner de l'org, pas celui de la personne qui
  // édite — même bug que content_pieces (cf. historique de cette route),
  // corrigé ici de la même façon.
  //
  // maybeSingle() plutôt que single() : si le WHERE (id + user_id) ne matche
  // aucune ligne — mauvais dataOwnerId, RLS qui bloque silencieusement,
  // client d'une autre org — l'UPDATE affecte 0 ligne et single() lève
  // PGRST116 ("Cannot coerce the result to a single JSON object"), qui est
  // exactement l'erreur cryptique remontée par l'UI. On distingue ici
  // explicitement "0 ligne affectée" (403/404, message clair) d'une vraie
  // erreur Postgres.
  const { data, error } = await supabase
    .from('clients')
    .update(body)
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error(
      '[api/clients PATCH] échec —',
      'client_id:', params.id,
      '| fields:', Object.keys(body),
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
  if (!data) {
    console.error(
      '[api/clients PATCH] 0 ligne affectée —',
      'client_id:', params.id, '| user:', ctx.userId, '| role:', ctx.role, '| dataOwnerId:', ctx.dataOwnerId,
    )
    return NextResponse.json({ error: 'Client introuvable ou accès refusé' }, { status: 404 })
  }
  return NextResponse.json({ data })
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
    .delete()
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
