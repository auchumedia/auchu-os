'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn, getInitials, formatDate } from '@/lib/utils'
import {
  Plus, Copy, Check, X, UserMinus, UserCheck, UserX, ChevronDown,
  Loader2, Clock, Link2, Trash2, ShieldCheck, Mail, CheckCircle2, RefreshCw,
  UsersRound, Settings2, PenSquare,
} from 'lucide-react'
import type { OrgRole, OrgPlan } from '@/types'
import { roleLabel, manageableRoles as getManageableRoles, canManageRole } from '@/lib/roles'
import { PLAN_LIMITS } from '@/lib/plans'

const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''

interface Profile { full_name: string | null; email: string | null; avatar_url: string | null }
interface TeamMemberRow { id: string; user_id: string; role: OrgRole; status: 'actif' | 'inactif'; joined_at: string; profile: Profile | null }
interface TeamClientRow { id: string; client_id: string; assigned_at: string; client: { id: string; name: string; company: string | null; status: string } | null }
interface TeamData { id: string; org_id: string; name: string; chef_id: string; members: TeamMemberRow[]; clients: TeamClientRow[] }
interface UnassignedMember { id: string; user_id: string; role: OrgRole; profile: Profile | null }
interface AllMemberRow { id: string; user_id: string; role: OrgRole; status: 'actif' | 'inactif'; profile: Profile | null }
interface InvitationRow { id: string; code: string; role: OrgRole; team_id: string | null; expires_at: string; created_at: string; invited_name: string | null; invited_email: string | null }

interface InviteForm { first_name: string; last_name: string; email: string; role: OrgRole }

interface Props {
  role:                   OrgRole
  currentUserId:          string
  canManageOrgStructure:  boolean
  isTeamChef:             boolean
  org:                    { id: string; name: string; plan: OrgPlan; max_members: number } | null
  activeMemberCount:      number
  allMembers:             AllMemberRow[]
  teams:                  TeamData[]
  invitations:            InvitationRow[]
  unassignedMembers:      UnassignedMember[]
  unassignedClients:      { id: string; name: string }[]
  chefCandidates:         UnassignedMember[]
  workload:               Record<string, number>
}

function memberName(p: Profile | null) {
  return p?.full_name || p?.email?.split('@')[0] || 'Inconnu'
}

export default function EquipeClient({
  role, currentUserId, canManageOrgStructure, isTeamChef, org, activeMemberCount, allMembers,
  teams: initialTeams, invitations: initialInv, unassignedMembers, unassignedClients,
  chefCandidates, workload,
}: Props) {
  const router = useRouter()
  const [teams,       setTeams]       = useState(initialTeams)
  const [invitations, setInvitations] = useState(initialInv)

  // La plupart des actions (changer un rôle, assigner un client, etc.) ne
  // font pas de mise à jour optimiste — elles appellent router.refresh() et
  // comptent sur le Server Component pour renvoyer des props fraîches.
  // useState(initialTeams) ne se resynchronise jamais tout seul quand une
  // prop change après le montage initial, d'où ce useEffect explicite —
  // sans lui, un changement de rôle est bien enregistré en base mais l'UI
  // continue d'afficher l'ancien état local (symptôme : "ça ne fait rien").
  useEffect(() => { setTeams(initialTeams) }, [initialTeams])
  useEffect(() => { setInvitations(initialInv) }, [initialInv])
  const [showInvite,  setShowInvite]  = useState(false)
  const [showCreate,  setShowCreate]  = useState(false)
  const [loading,     setLoading]     = useState<string | null>(null)
  const [copied,      setCopied]      = useState<string | null>(null)
  const [emailSent,   setEmailSent]   = useState<string | null>(null)

  const myManageableRoles = getManageableRoles(role)
  const canInvite = myManageableRoles.length > 0

  const [inviteForm, setInviteForm] = useState<InviteForm>({
    first_name: '', last_name: '', email: '', role: myManageableRoles[myManageableRoles.length - 1] ?? 'monteur',
  })
  const setField = (k: keyof InviteForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setInviteForm(f => ({ ...f, [k]: e.target.value }))

  const [teamName, setTeamName] = useState('')
  const [teamChef, setTeamChef] = useState('')

  const copyText = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  // Rafraîchit automatiquement tant qu'il reste des invitations en attente —
  // contourne le Router Cache client de Next.js après qu'un invité a rejoint.
  useEffect(() => {
    if (invitations.length === 0) return
    const refresh = () => router.refresh()
    const interval = setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [invitations.length, router])

  const createInvite = async () => {
    setLoading('invite')
    const res = await fetch('/api/equipe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        role:       inviteForm.role,
        first_name: inviteForm.first_name.trim(),
        last_name:  inviteForm.last_name.trim(),
        email:      inviteForm.email.trim(),
      }),
    })
    const json = await res.json()
    setLoading(null)
    if (res.ok) {
      setInvitations(prev => [json.data, ...prev])
      setShowInvite(false)
      setInviteForm(f => ({ ...f, first_name: '', last_name: '', email: '' }))
      if (json.email_sent) setEmailSent(json.data.id)
    } else {
      alert(json.error)
    }
  }

  const patchMember = async (memberId: string, fields: { role?: OrgRole; status?: 'actif' | 'inactif' }) => {
    setLoading(memberId)
    const res = await fetch(`/api/equipe/${memberId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    })
    setLoading(null)
    if (!res.ok) { const j = await res.json(); alert(j.error); return }
    router.refresh()
  }

  const removeMemberFromOrg = async (memberId: string) => {
    if (!confirm('Supprimer définitivement ce compte de l\'organisation ?')) return
    setLoading(memberId)
    const res = await fetch(`/api/equipe/${memberId}`, { method: 'DELETE' })
    setLoading(null)
    if (res.ok) router.refresh()
  }

  const removeMemberFromTeam = async (teamId: string, userId: string) => {
    if (!confirm('Retirer ce membre de l\'équipe ?')) return
    setLoading(`team-member-${userId}`)
    const res = await fetch(`/api/teams/${teamId}/members?userId=${userId}`, { method: 'DELETE' })
    setLoading(null)
    if (res.ok) router.refresh()
    else { const j = await res.json(); alert(j.error) }
  }

  const assignClient = async (teamId: string, clientId: string) => {
    setLoading(`assign-${clientId}`)
    const res = await fetch(`/api/teams/${teamId}/clients`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }),
    })
    setLoading(null)
    if (res.ok) router.refresh()
    else { const j = await res.json(); alert(j.error) }
  }

  const unassignClient = async (teamId: string, clientId: string) => {
    setLoading(`unassign-${clientId}`)
    const res = await fetch(`/api/teams/${teamId}/clients?clientId=${clientId}`, { method: 'DELETE' })
    setLoading(null)
    if (res.ok) router.refresh()
  }

  const createTeam = async () => {
    if (!teamName.trim() || !teamChef) return
    setLoading('create-team')
    const res = await fetch('/api/teams', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: teamName.trim(), chef_id: teamChef }),
    })
    const json = await res.json()
    setLoading(null)
    if (res.ok) { setShowCreate(false); setTeamName(''); setTeamChef(''); router.refresh() }
    else alert(json.error)
  }

  const deleteTeam = async (teamId: string) => {
    if (!confirm('Supprimer cette équipe ? Ses membres et clients redeviendront non assignés.')) return
    setLoading(`delete-team-${teamId}`)
    const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
    setLoading(null)
    if (res.ok) { setTeams(prev => prev.filter(t => t.id !== teamId)); router.refresh() }
  }

  const revokeInvitation = async (id: string) => {
    if (!confirm('Révoquer cette invitation ?')) return
    setLoading(`inv-${id}`)
    const res = await fetch(`/api/invitations/${id}`, { method: 'DELETE' })
    setLoading(null)
    if (res.ok) setInvitations(prev => prev.filter(i => i.id !== id))
    else alert('Erreur lors de la révocation')
  }

  const plan = org ? (PLAN_LIMITS[org.plan] ?? PLAN_LIMITS.free) : null

  return (
    <div className="space-y-6">

      {/* ── Plan bar — owner uniquement ───────────────────────────────────────── */}
      {role === 'owner' && org && plan && (
        <div className="card flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className={cn('px-2.5 py-1 rounded-lg text-sm font-semibold', {
              'bg-gray-100   text-gray-600':   org.plan === 'free',
              'bg-blue-100   text-blue-700':   org.plan === 'starter',
              'bg-auchu-100  text-auchu-700':  org.plan === 'agence',
              'bg-purple-100 text-purple-700': org.plan === 'pro',
            })}>
              {plan.label}
            </span>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{activeMemberCount}</span>
              <span className="text-gray-400"> / </span>
              <span>{org.max_members === 999 ? '∞' : org.max_members}</span>
              <span className="text-gray-400 ml-1">membres</span>
            </div>
            <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-auchu-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (activeMemberCount / (org.max_members === 999 ? Math.max(activeMemberCount, 1) : org.max_members)) * 100)}%` }}
              />
            </div>
          </div>
          <a href="/settings" className="text-xs text-auchu-600 hover:text-auchu-700 font-medium hover:underline">
            Gérer le plan →
          </a>
        </div>
      )}

      {/* ── En-tête d'actions ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
        {canManageOrgStructure && chefCandidates.length > 0 && (
          <button onClick={() => setShowCreate(true)} className="btn-secondary text-sm gap-1.5 w-full sm:w-auto justify-center">
            <UsersRound className="w-3.5 h-3.5" /> Créer une équipe
          </button>
        )}
        {canInvite && (
          <button onClick={() => setShowInvite(true)} className="btn-primary text-sm gap-1.5 w-full sm:w-auto justify-center">
            <Plus className="w-3.5 h-3.5" /> Inviter
          </button>
        )}
      </div>

      {/* ── Tous les membres (owner/director) ────────────────────────────────── */}
      {canManageOrgStructure && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Tous les membres
              <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{allMembers.length}</span>
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {allMembers.map(member => {
              const name        = memberName(member.profile)
              const roleCfg     = roleLabel(member.role)
              const isMe        = member.user_id === currentUserId
              const isInactive  = member.status === 'inactif'
              const isLoading   = loading === member.id
              const canManageThis = !isMe && member.role !== 'owner' && canManageRole(role, member.role)

              return (
                <div key={member.id} className={cn('flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4 px-4 sm:px-5 py-3.5 transition-colors', isInactive && 'bg-gray-50/60 opacity-60')}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0', isInactive ? 'bg-gray-200 text-gray-400' : 'bg-auchu-100 text-auchu-700')}>
                      {member.profile?.avatar_url
                        ? <img src={member.profile.avatar_url} alt={name} className="w-9 h-9 rounded-full object-cover" />
                        : getInitials(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-gray-900 text-sm truncate">{name}</p>
                        {isMe && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">vous</span>}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{member.profile?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pl-12 sm:pl-0 sm:flex-shrink-0">
                    {workload[member.user_id] > 0 && (
                      <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-semibold text-[10px] flex-shrink-0">{workload[member.user_id]}</span>
                    )}

                    {canManageThis && !isLoading ? (
                      <div className="relative flex-shrink-0">
                        <select
                          value={member.role}
                          onChange={e => patchMember(member.id, { role: e.target.value as OrgRole })}
                          className="text-xs font-medium rounded-full pl-2.5 pr-6 py-1 min-h-[36px] border border-transparent appearance-none cursor-pointer transition-colors bg-transparent hover:border-gray-200"
                        >
                          {getManageableRoles(role).map(r => <option key={r} value={r}>{roleLabel(r).label}</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                      </div>
                    ) : (
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0', roleCfg.cls)}>{roleCfg.label}</span>
                    )}

                    {canManageThis && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {isLoading
                          ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          : <>
                              <button
                                onClick={() => patchMember(member.id, { status: isInactive ? 'actif' : 'inactif' })}
                                title={isInactive ? 'Réactiver' : 'Désactiver'}
                                className="p-2.5 min-h-[40px] min-w-[40px] rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                              >
                                {isInactive ? <UserCheck className="w-3.5 h-3.5" /> : <UserMinus className="w-3.5 h-3.5" />}
                              </button>
                              {role === 'owner' && (
                                <button
                                  onClick={() => removeMemberFromOrg(member.id)}
                                  title="Supprimer le compte"
                                  className="p-2.5 min-h-[40px] min-w-[40px] rounded-lg hover:bg-red-50 transition-colors text-gray-300 hover:text-red-400"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                        }
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {allMembers.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">Aucun membre pour l'instant</div>
            )}
          </div>
        </div>
      )}

      {/* ── Équipes ───────────────────────────────────────────────────────────── */}
      {teams.map(team => {
        const chef = team.members.find(m => m.user_id === team.chef_id)
        const canEditThisTeam = canManageOrgStructure || (isTeamChef && team.chef_id === currentUserId)
        return (
          <div key={team.id} className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  {team.name}
                  <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{team.members.length} membre{team.members.length !== 1 ? 's' : ''}</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Chef d'équipe : {chef ? memberName(chef.profile) : '—'}</p>
              </div>
              {canManageOrgStructure && (
                <button
                  onClick={() => deleteTeam(team.id)}
                  disabled={loading === `delete-team-${team.id}`}
                  title="Supprimer l'équipe"
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-300 hover:text-red-400"
                >
                  {loading === `delete-team-${team.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {/* Membres */}
            <div className="divide-y divide-gray-50">
              {team.members.map(member => {
                const name        = memberName(member.profile)
                const roleCfg     = roleLabel(member.role)
                const isMe        = member.user_id === currentUserId
                const isChef      = member.user_id === team.chef_id
                const isInactive  = member.status === 'inactif'
                const tasks       = workload[member.user_id] ?? 0
                const isLoading   = loading === member.id
                const canManageThis = canEditThisTeam && !isChef && !isMe

                return (
                  <div key={member.id} className={cn('flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4 px-4 sm:px-5 py-3.5 transition-colors', isInactive && 'bg-gray-50/60 opacity-60')}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0', isInactive ? 'bg-gray-200 text-gray-400' : 'bg-auchu-100 text-auchu-700')}>
                        {member.profile?.avatar_url
                          ? <img src={member.profile.avatar_url} alt={name} className="w-9 h-9 rounded-full object-cover" />
                          : getInitials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-gray-900 text-sm truncate">{name}</p>
                          {isMe && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">vous</span>}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{member.profile?.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pl-12 sm:pl-0 sm:flex-shrink-0">
                      {tasks > 0 && (
                        <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-semibold text-[10px] flex-shrink-0">{tasks}</span>
                      )}

                      {canManageThis && !isLoading ? (
                        <div className="relative flex-shrink-0">
                          <select
                            value={member.role}
                            onChange={e => patchMember(member.id, { role: e.target.value as OrgRole })}
                            className="text-xs font-medium rounded-full pl-2.5 pr-6 py-1 min-h-[36px] border border-transparent appearance-none cursor-pointer transition-colors bg-transparent hover:border-gray-200"
                          >
                            {getManageableRoles(role).map(r => <option key={r} value={r}>{roleLabel(r).label}</option>)}
                          </select>
                          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                        </div>
                      ) : (
                        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0', roleCfg.cls)}>{roleCfg.label}</span>
                      )}

                      {canManageThis && (
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {isLoading
                            ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            : <>
                                <button
                                  onClick={() => patchMember(member.id, { status: isInactive ? 'actif' : 'inactif' })}
                                  title={isInactive ? 'Réactiver' : 'Désactiver'}
                                  className="p-2.5 min-h-[40px] min-w-[40px] rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                                >
                                  {isInactive ? <UserCheck className="w-3.5 h-3.5" /> : <UserMinus className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => removeMemberFromTeam(team.id, member.user_id)}
                                  title="Retirer de l'équipe"
                                  className="p-2.5 min-h-[40px] min-w-[40px] rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                                {role === 'owner' && (
                                  <button
                                    onClick={() => removeMemberFromOrg(member.id)}
                                    title="Supprimer le compte"
                                    className="p-2.5 min-h-[40px] min-w-[40px] rounded-lg hover:bg-red-50 transition-colors text-gray-300 hover:text-red-400"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                          }
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Clients */}
            <div className="px-5 py-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2.5">
                Clients ({team.clients.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {team.clients.map(tc => (
                  <span key={tc.id} className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                    {tc.client?.name ?? 'Client'}
                    {canManageOrgStructure && (
                      <button onClick={() => unassignClient(team.id, tc.client_id)} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
                {team.clients.length === 0 && <span className="text-xs text-gray-400">Aucun client assigné</span>}
              </div>
              {canManageOrgStructure && unassignedClients.length > 0 && (
                <select
                  value=""
                  onChange={e => e.target.value && assignClient(team.id, e.target.value)}
                  className="mt-3 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600"
                >
                  <option value="">+ Assigner un client…</option>
                  {unassignedClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          </div>
        )
      })}

      {teams.length === 0 && (
        <div className="card text-center py-10">
          <UsersRound className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {canManageOrgStructure ? 'Aucune équipe pour l\'instant.' : 'Vous n\'êtes assigné à aucune équipe pour l\'instant.'}
          </p>
        </div>
      )}

      {/* ── Non assignés (owner/director) ────────────────────────────────────── */}
      {canManageOrgStructure && (unassignedMembers.length > 0 || unassignedClients.length > 0) && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Non assignés</h2>
          </div>
          {unassignedMembers.length > 0 && (
            <div className="space-y-2 mb-4">
              {unassignedMembers.map(m => {
                const roleCfg = roleLabel(m.role)
                return (
                  <div key={m.id} className="flex items-center gap-3 text-sm">
                    <span className="font-medium text-gray-800">{memberName(m.profile)}</span>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', roleCfg.cls)}>{roleCfg.label}</span>
                    {m.role === 'chef_equipe' && <span className="text-xs text-gray-400">— créez une équipe pour ce membre</span>}
                  </div>
                )
              })}
            </div>
          )}
          {unassignedClients.length > 0 && (
            <p className="text-xs text-gray-400">
              {unassignedClients.length} client{unassignedClients.length !== 1 ? 's' : ''} sans équipe — assignez-les depuis une équipe ci-dessus.
            </p>
          )}
        </div>
      )}

      {/* ── Invitations en attente ───────────────────────────────────────────── */}
      {invitations.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Invitations en attente
              <span className="ml-2 text-xs font-normal bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">{invitations.length}</span>
            </h2>
            <button
              onClick={() => router.refresh()}
              title="Rafraîchir la liste"
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {invitations.map(inv => {
              const link        = `${APP_URL}/invite/${inv.code}`
              const expired     = new Date(inv.expires_at) < new Date()
              const roleCfg     = roleLabel(inv.role)
              const isRevoking  = loading === `inv-${inv.id}`
              const wasJustSent = emailSent === inv.id

              return (
                <div key={inv.id} className="px-4 sm:px-5 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Mail className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">{inv.invited_name || 'Invitation'}</p>
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', roleCfg.cls)}>{roleCfg.label}</span>
                          {wasJustSent && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="w-3 h-3" /> Email envoyé
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {inv.invited_email && <p className="text-xs text-gray-400 truncate">{inv.invited_email}</p>}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-3 h-3 text-gray-300" />
                            <span className={cn('text-xs', expired ? 'text-red-500' : 'text-gray-400')}>
                              {expired ? 'Expiré' : `Expire le ${formatDate(inv.expires_at)}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pl-12 sm:pl-0 sm:flex-shrink-0">
                      <button
                        onClick={() => copyText(inv.code, `code-${inv.id}`)}
                        title="Copier le code"
                        className="flex items-center gap-1 text-xs px-2 py-1.5 min-h-[40px] rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                      >
                        {copied === `code-${inv.id}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        Code
                      </button>
                      <button
                        onClick={() => copyText(link, `link-${inv.id}`)}
                        title="Copier le lien d'invitation"
                        className="flex items-center gap-1 text-xs px-2 py-1.5 min-h-[40px] rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                      >
                        {copied === `link-${inv.id}` ? <Check className="w-3 h-3 text-green-500" /> : <Link2 className="w-3 h-3" />}
                        Lien
                      </button>
                      <button
                        onClick={() => revokeInvitation(inv.id)}
                        disabled={isRevoking}
                        title="Révoquer cette invitation"
                        className="p-2.5 min-h-[40px] min-w-[40px] rounded-lg hover:bg-red-50 transition-colors text-gray-300 hover:text-red-400 disabled:opacity-50"
                      >
                        {isRevoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Grille des rôles ────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Permissions par rôle</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['director', 'chef_equipe', 'stratege', 'monteur'] as const).map(r => {
            const cfg = roleLabel(r)
            return (
              <div key={r} className="rounded-xl border border-gray-100 p-3 space-y-1.5">
                <span className={cn('inline-flex text-xs font-medium px-2 py-0.5 rounded-full', cfg.cls)}>{cfg.label}</span>
                <p className="text-xs text-gray-500 leading-relaxed">{cfg.desc}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Modal création d'équipe ───────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-4 sm:p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Créer une équipe</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 -m-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nom de l'équipe</label>
                <input type="text" className="input" placeholder="Équipe 1" value={teamName} onChange={e => setTeamName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label">Chef d'équipe</label>
                <select value={teamChef} onChange={e => setTeamChef(e.target.value)} className="input">
                  <option value="">Sélectionner…</option>
                  {chefCandidates.map(c => (
                    <option key={c.user_id} value={c.user_id}>{memberName(c.profile)}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Seuls les membres ayant déjà le rôle « Chef d'équipe » et ne dirigeant pas encore d'équipe apparaissent ici.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Annuler</button>
              <button
                onClick={createTeam}
                disabled={loading === 'create-team' || !teamName.trim() || !teamChef}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {loading === 'create-team' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PenSquare className="w-3.5 h-3.5" /> Créer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal invitation ─────────────────────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowInvite(false)}>
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-4 sm:p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Inviter un membre</h3>
              <button onClick={() => setShowInvite(false)} className="p-2 -m-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Prénom</label>
                  <input type="text" className="input" placeholder="Samuel" value={inviteForm.first_name} onChange={setField('first_name')} autoFocus />
                </div>
                <div>
                  <label className="label">Nom</label>
                  <input type="text" className="input" placeholder="Martin" value={inviteForm.last_name} onChange={setField('last_name')} />
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="samuel@exemple.com" value={inviteForm.email} onChange={setField('email')} />
              </div>

              <div>
                <label className="label">Rôle</label>
                <select value={inviteForm.role} onChange={setField('role')} className="input">
                  {myManageableRoles.map(r => (
                    <option key={r} value={r}>{roleLabel(r).label} — {roleLabel(r).desc}</option>
                  ))}
                </select>
                {isTeamChef && (
                  <p className="text-xs text-gray-400 mt-1">La personne invitée rejoindra automatiquement votre équipe.</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-700">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              Un email d'invitation sera envoyé avec un lien valide 7 jours
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowInvite(false)} className="btn-secondary flex-1">Annuler</button>
              <button
                onClick={createInvite}
                disabled={loading === 'invite' || !inviteForm.first_name || !inviteForm.last_name || !inviteForm.email}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {loading === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-3.5 h-3.5" /> Envoyer l'invitation</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
