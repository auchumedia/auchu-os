import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

const TASK_SELECT = '*, client:clients(id, name, company)'

// stratege/monteur : statut seulement (imposé aussi par le trigger SQL
// tasks_enforce_role_update — migration 034, défense en profondeur).
const RESTRICTED_ROLES = ['stratege', 'monteur']
const FULL_FIELDS       = ['title', 'description', 'assigned_to', 'client_id', 'priority', 'status', 'deadline']
const RESTRICTED_FIELDS = ['status']

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = RESTRICTED_ROLES.includes(ctx.role) ? RESTRICTED_FIELDS : FULL_FIELDS

  const fields: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) fields[key] = body[key]
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Aucun champ modifiable fourni' }, { status: 400 })
  }

  const supabase = await createClient()

  // tasks.user_id est l'ID du owner de l'org (dataOwnerId), pas celui de la
  // personne qui édite — même raison que content_pieces (cf. api/contenus/[id]).
  const { data, error } = await supabase
    .from('tasks')
    .update(fields)
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .select(TASK_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
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
    .from('tasks')
    .delete()
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
