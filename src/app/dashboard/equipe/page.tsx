import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import EquipeClient      from './EquipeClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Équipe' }

export default async function EquipePage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')
  if (!ctx.canManageTeam && ctx.role !== 'owner') redirect('/dashboard')

  if (!ctx.org) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Équipe</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez les membres de votre organisation</p>
        </div>
        <div className="card text-center py-16 space-y-3">
          <p className="text-gray-400">Vous n'avez pas encore d'organisation.</p>
          <p className="text-sm text-gray-400">
            Créez votre agence depuis <a href="/settings" className="text-auchu-600 underline">Paramètres</a>.
          </p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  const [orgMembersRes, invitesRes, contentRes] = await Promise.all([
    // org_members sans embed profiles — pas de FK direct org_members.user_id→profiles.id
    supabase
      .from('org_members')
      .select('id, user_id, role, status, joined_at')
      .eq('org_id', ctx.org.id)
      .order('joined_at', { ascending: true }),

    supabase
      .from('invitations')
      .select('id, code, role, expires_at, created_at, invited_name, invited_email')
      .eq('org_id', ctx.org.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),

    // Charge de travail : contenus non terminés par assigned_user_id
    supabase
      .from('content_pieces')
      .select('assigned_user_id')
      .eq('user_id', ctx.dataOwnerId)
      .not('assigned_user_id', 'is', null)
      .not('status', 'in', '(approuve,publie,refuse)'),
  ])

  // Récupérer les profiles séparément (profiles.id = auth.users.id)
  const userIds = (orgMembersRes.data ?? []).map(m => m.user_id)
  const { data: profilesData } = userIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', userIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[] }

  const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]))

  // Fusionner org_members + profiles
  const membersWithProfiles = (orgMembersRes.data ?? []).map(m => ({
    ...m,
    profile: profileMap[m.user_id] ?? null,
  }))

  // Compter les contenus par membre
  const workload: Record<string, number> = {}
  for (const c of contentRes.data ?? []) {
    if (c.assigned_user_id) {
      workload[c.assigned_user_id] = (workload[c.assigned_user_id] ?? 0) + 1
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Équipe</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez les membres de {ctx.org.name}</p>
      </div>
      <EquipeClient
        org={ctx.org as any}
        members={membersWithProfiles as any}
        invitations={(invitesRes.data ?? []) as any}
        workload={workload}
        currentUserId={ctx.userId}
        isOwner={ctx.isOwner}
      />
    </div>
  )
}
