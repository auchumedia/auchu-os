import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { NextResponse }  from 'next/server'

const TASK_SELECT = '*, client:clients(id, name, company)'

// Édition complète (titre/description/priorité/deadline/assigné à) réservée
// au créateur de la tâche (assigned_by) ou à owner/director. Toute autre
// personne (y compris un simple assigné, quel que soit son rôle) ne peut
// changer que le statut — imposé aussi par le trigger SQL
// tasks_enforce_role_update (migration 035, défense en profondeur : ne pas
// se fier uniquement à ce filtrage côté route API).
const FULL_FIELDS       = ['title', 'description', 'assigned_to', 'client_id', 'priority', 'status', 'deadline']
const RESTRICTED_FIELDS = ['status']

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('tasks')
    .select('assigned_by, assigned_to, status')
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  const isPrivileged = ctx.isOwner || ctx.isDirector || existing.assigned_by === ctx.userId
  const allowed = isPrivileged ? FULL_FIELDS : RESTRICTED_FIELDS

  const body = await req.json()
  const fields: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) fields[key] = body[key]
  }
  const rejectedFields = Object.keys(body).filter(key => FULL_FIELDS.includes(key) && !(key in fields))

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Aucun champ modifiable fourni' }, { status: 400 })
  }
  if (rejectedFields.length > 0) {
    return NextResponse.json(
      { error: 'Seul le créateur de la tâche ou un owner/director peut modifier autre chose que le statut' },
      { status: 403 }
    )
  }

  // Approuver (passage à 'approuve') : jamais en auto-approbation (créateur
  // ET assigné = soi-même) ; sinon réservé à owner/director (toute tâche)
  // ou au créateur de la tâche (un chef_equipe n'approuve donc que ce qu'il
  // a lui-même créé — même règle imposée par le trigger SQL
  // tasks_enforce_role_update, migration 037, défense en profondeur).
  if (fields.status === 'approuve' && existing.status !== 'approuve') {
    const isSelfAssigned = existing.assigned_by === ctx.userId && existing.assigned_to === ctx.userId
    const canApprove = !isSelfAssigned && (ctx.isOwner || ctx.isDirector || existing.assigned_by === ctx.userId)

    if (!canApprove) {
      return NextResponse.json(
        {
          error: isSelfAssigned
            ? 'Vous ne pouvez pas approuver une tâche que vous vous êtes assignée vous-même'
            : 'Seul owner/director, ou le créateur de la tâche, peut l\'approuver',
        },
        { status: 403 }
      )
    }

    // Horodatage/auteur fixés côté serveur, jamais acceptés depuis le client.
    fields.approved_by = ctx.userId
    fields.approved_at = new Date().toISOString()
  }

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

  // Vérification explicite avant suppression : sans ça, un DELETE bloqué par
  // la RLS (ligne non visible/non autorisée pour cet acteur) supprime 0 ligne
  // sans remonter d'erreur — la route répondrait success:true alors que rien
  // n'a été supprimé, et l'UI retirerait la tâche à tort de l'écran.
  const { data: existing, error: fetchError } = await supabase
    .from('tasks')
    .select('assigned_by, assigned_to, status')
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  // Créateur ou owner/director : peuvent supprimer peu importe le statut.
  // Personne assignée : seulement une fois la tâche approuvée (migration 036).
  const isPrivileged = ctx.isOwner || ctx.isDirector
    || existing.assigned_by === ctx.userId
    || (existing.status === 'approuve' && existing.assigned_to === ctx.userId)

  if (!isPrivileged) {
    return NextResponse.json(
      { error: 'Seul le créateur, un owner/director, ou la personne assignée (une fois la tâche approuvée) peut la supprimer' },
      { status: 403 }
    )
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
