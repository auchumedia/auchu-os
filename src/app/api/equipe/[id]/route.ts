import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { canManageRole } from '@/lib/roles'
import { NextResponse }  from 'next/server'
import type { OrgRole }  from '@/types'

const VALID_ROLES: OrgRole[] = ['director', 'chef_equipe', 'stratege', 'monteur']

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.org) return NextResponse.json({ error: 'Aucune organisation' }, { status: 404 })

  const supabase = await createClient()

  const { data: member } = await supabase
    .from('org_members')
    .select('user_id, role')
    .eq('id', params.id)
    .eq('org_id', ctx.org.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  if (member.role === 'owner') return NextResponse.json({ error: 'Impossible de modifier le propriétaire' }, { status: 403 })

  const body = await req.json()
  const allowed: Record<string, unknown> = {}

  if (body.role && VALID_ROLES.includes(body.role)) {
    if (!canManageRole(ctx.role, member.role as OrgRole) || !canManageRole(ctx.role, body.role)) {
      return NextResponse.json({ error: 'Rôle invalide pour votre niveau d\'accès' }, { status: 403 })
    }
    if (ctx.isTeamChef) {
      const { data: inTeam } = await supabase
        .from('team_memberships')
        .select('id')
        .eq('team_id', ctx.teamId ?? '')
        .eq('user_id', member.user_id)
        .maybeSingle()
      if (!inTeam) return NextResponse.json({ error: 'Ce membre n\'appartient pas à votre équipe' }, { status: 403 })
    }
    if (member.role === 'chef_equipe' && body.role !== 'chef_equipe') {
      const { data: leadsTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('chef_id', member.user_id)
        .maybeSingle()
      if (leadsTeam) {
        return NextResponse.json(
          { error: 'Ce membre dirige une équipe — réassignez ou supprimez l\'équipe avant de changer son rôle' },
          { status: 409 }
        )
      }
    }
    allowed.role = body.role
  }
  if (body.status && ['actif', 'inactif'].includes(body.status)) {
    if (!canManageRole(ctx.role, member.role as OrgRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    allowed.status = body.status
  }

  if (!Object.keys(allowed).length) return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })

  // Pas d'embed profile:profiles(...) ici : dépend du cache de relations
  // PostgREST, qui peut rester périmé après une migration DDL et faire
  // échouer la requête (PGRST200 "Could not find a relationship..."), comme
  // vu sur equipe/page.tsx. Profil récupéré séparément.
  const { data, error } = await supabase
    .from('org_members')
    .update(allowed)
    .eq('id', params.id)
    .eq('org_id', ctx.org.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, avatar_url')
    .eq('id', data.user_id)
    .maybeSingle()

  // team_memberships.role n'est pas mis à jour automatiquement par le trigger
  // (aucune FK entre org_members et team_memberships) — le synchroniser ici.
  if (allowed.role) {
    if (allowed.role === 'stratege' || allowed.role === 'monteur') {
      await supabase.from('team_memberships').update({ role: allowed.role }).eq('user_id', member.user_id)
    } else {
      // director, ou chef_equipe fraîchement promu (pas encore d'équipe à lui) :
      // ne doit plus figurer comme stratège/monteur d'une équipe.
      await supabase.from('team_memberships').delete().eq('user_id', member.user_id)
    }
  }

  return NextResponse.json({ data: { ...data, profile: profile ?? null } })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isOwner || !ctx.org) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const supabase = await createClient()

  const { data: member } = await supabase
    .from('org_members')
    .select('user_id, role')
    .eq('id', params.id)
    .eq('org_id', ctx.org.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  if (member.role === 'owner') return NextResponse.json({ error: 'Impossible de retirer le propriétaire' }, { status: 403 })

  if (member.role === 'chef_equipe') {
    const { data: leadsTeam } = await supabase.from('teams').select('id').eq('chef_id', member.user_id).maybeSingle()
    if (leadsTeam) {
      return NextResponse.json(
        { error: 'Ce membre dirige une équipe — réassignez ou supprimez l\'équipe avant de le supprimer' },
        { status: 409 }
      )
    }
  }

  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('id', params.id)
    .eq('org_id', ctx.org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pas de FK entre org_members et team_memberships — nettoyer manuellement.
  await supabase.from('team_memberships').delete().eq('user_id', member.user_id)

  return NextResponse.json({ success: true })
}
