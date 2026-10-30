import { createClient }   from '@/lib/supabase/server'
import { getOrgContext }  from '@/lib/org'
import { canCreateTasks } from '@/lib/roles'
import { NextResponse }   from 'next/server'

const TASK_SELECT = '*, client:clients(id, name, company)'

export async function GET() {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('user_id', ctx.dataOwnerId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canCreateTasks(ctx.role)) {
    return NextResponse.json(
      { error: 'Accès refusé — seuls owner et director peuvent créer une tâche' },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { title, description, assigned_to, client_id, priority, deadline } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 })
  }

  const supabase = await createClient()

  // ── Validation de la cible d'assignation selon le rôle ────────────────────
  // owner/director : n'importe quel membre actif de l'org (ou eux-mêmes).
  if (assigned_to) {
    if (ctx.org && assigned_to !== ctx.org.owner_id) {
      const { data: member } = await supabase
        .from('org_members')
        .select('user_id')
        .eq('org_id', ctx.org.id)
        .eq('status', 'actif')
        .eq('user_id', assigned_to)
        .maybeSingle()
      if (!member) {
        return NextResponse.json({ error: 'Membre introuvable dans l\'organisation' }, { status: 403 })
      }
    } else if (!ctx.org && assigned_to !== ctx.userId) {
      return NextResponse.json({ error: 'Membre introuvable' }, { status: 403 })
    }
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id:      ctx.dataOwnerId,
      assigned_by:  ctx.userId,
      title:        title.trim(),
      description:  description?.trim() || null,
      assigned_to:  assigned_to || null,
      client_id:    client_id || null,
      priority:     priority || 'normale',
      deadline:     deadline || null,
    })
    .select(TASK_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
