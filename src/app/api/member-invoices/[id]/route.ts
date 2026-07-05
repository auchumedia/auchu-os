import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('member_invoices')
    .select('id, member_id, org_id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const body = await req.json()
  const nextStatus = body.status

  const isSelf             = existing.member_id === ctx.userId
  const isOwnerOrDirector  = ctx.isOwner || ctx.isDirector

  const fields: Record<string, unknown> = {}

  if (isSelf && !isOwnerOrDirector) {
    if (existing.status !== 'brouillon' || nextStatus !== 'envoyee') {
      return NextResponse.json({ error: 'Tu ne peux qu\'envoyer une facture en brouillon' }, { status: 403 })
    }
    fields.status = 'envoyee'
  } else if (isOwnerOrDirector) {
    if (!['approuvee', 'payee'].includes(nextStatus)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }
    fields.status = nextStatus
    if (nextStatus === 'approuvee') {
      fields.approved_by = ctx.userId
      fields.approved_at = new Date().toISOString()
    }
    if (nextStatus === 'payee') {
      fields.paid_at = new Date().toISOString()
      if (existing.status === 'envoyee') {
        fields.approved_by = ctx.userId
        fields.approved_at = new Date().toISOString()
      }
    }
  } else {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('member_invoices')
    .update(fields)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('member_invoices')
    .select('id, member_id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  if (existing.member_id !== ctx.userId || existing.status !== 'brouillon') {
    return NextResponse.json({ error: 'Seul un brouillon peut être supprimé, par son auteur' }, { status: 403 })
  }

  const { error } = await supabase
    .from('member_invoices')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
