'use client'

import { useState, useCallback } from 'react'
import { cn, getInitials, formatDate } from '@/lib/utils'
import {
  Plus, Copy, Check, X, ChevronDown, UserMinus, UserCheck,
  Loader2, Clock, Link2, Trash2, ShieldCheck,
} from 'lucide-react'
import type { OrgMember, Invitation, Organization, OrgRole } from '@/types'
import { PLAN_LIMITS } from '@/lib/plans'

const ROLE_CONFIG: Record<OrgRole, { label: string; cls: string; desc: string }> = {
  owner:   { label: 'Propriétaire', cls: 'bg-auchu-100  text-auchu-700',  desc: 'Accès complet, facturation, équipe'              },
  manager: { label: 'Manager',      cls: 'bg-blue-100   text-blue-700',   desc: 'Clients, projets, calendrier, assigner des tâches' },
  partner: { label: 'Partenaire',   cls: 'bg-orange-100 text-orange-700', desc: 'Ses clients assignés, contenu, calendrier'         },
  editor:  { label: 'Éditeur',      cls: 'bg-green-100  text-green-700',  desc: 'Créer et éditer du contenu'                       },
  viewer:  { label: 'Observateur',  cls: 'bg-gray-100   text-gray-600',   desc: 'Lecture seule sur les projets'                    },
}

const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''

interface Props {
  org:           Organization
  members:       OrgMember[]
  invitations:   Invitation[]
  workload:      Record<string, number>
  currentUserId: string
}

export default function EquipeClient({ org, members: initial, invitations: initialInv, workload, currentUserId }: Props) {
  const [members,     setMembers]     = useState(initial)
  const [invitations, setInvitations] = useState(initialInv)
  const [showInvite,  setShowInvite]  = useState(false)
  const [newRole,     setNewRole]     = useState<Exclude<OrgRole, 'owner'>>('partner')
  const [loading,     setLoading]     = useState<string | null>(null)
  const [copied,      setCopied]      = useState<string | null>(null)

  const plan        = PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free
  const activeCount = members.filter(m => m.status === 'actif').length
  const canInvite   = activeCount < org.max_members

  const copyText = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  const createInvite = async () => {
    setLoading('invite')
    const res = await fetch('/api/equipe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role: newRole }),
    })
    const json = await res.json()
    setLoading(null)
    if (res.ok) {
      setInvitations(prev => [json.data, ...prev])
      setShowInvite(false)
    } else {
      alert(json.error)
    }
  }

  const patchMember = async (id: string, fields: Partial<OrgMember>) => {
    setLoading(id)
    const res = await fetch(`/api/equipe/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    })
    const json = await res.json()
    setLoading(null)
    if (res.ok) setMembers(prev => prev.map(m => m.id === id ? { ...m, ...json.data } : m))
    else alert(json.error)
  }

  const removeMember = async (id: string) => {
    if (!confirm('Retirer ce membre de l\'équipe ?')) return
    setLoading(id)
    const res = await fetch(`/api/equipe/${id}`, { method: 'DELETE' })
    setLoading(null)
    if (res.ok) setMembers(prev => prev.filter(m => m.id !== id))
  }

  const revokeInvitation = async (id: string) => {
    if (!confirm('Révoquer cette invitation ?')) return
    setLoading(`inv-${id}`)
    const res = await fetch(`/api/invitations/${id}`, { method: 'DELETE' })
    setLoading(null)
    if (res.ok) setInvitations(prev => prev.filter(i => i.id !== id))
    else alert('Erreur lors de la révocation')
  }

  return (
    <div className="space-y-6">

      {/* ── Plan bar ────────────────────────────────────────────────────────── */}
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
            <span className="font-semibold">{activeCount}</span>
            <span className="text-gray-400"> / </span>
            <span>{org.max_members === 999 ? '∞' : org.max_members}</span>
            <span className="text-gray-400 ml-1">membres</span>
          </div>
          <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-auchu-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (activeCount / (org.max_members === 999 ? Math.max(activeCount, 1) : org.max_members)) * 100)}%` }}
            />
          </div>
        </div>
        <a href="/settings" className="text-xs text-auchu-600 hover:text-auchu-700 font-medium hover:underline">
          Gérer le plan →
        </a>
      </div>

      {/* ── Membres actifs ───────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            Membres
            <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{members.length}</span>
          </h2>
          <button
            onClick={() => setShowInvite(true)}
            disabled={!canInvite}
            title={!canInvite ? `Limite de ${org.max_members} membres atteinte` : undefined}
            className="btn-primary text-sm gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Inviter
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {members.map(member => {
            const profile    = member.profile
            const name       = profile?.full_name || profile?.email?.split('@')[0] || 'Inconnu'
            const email      = profile?.email || ''
            const roleCfg    = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.viewer
            const isMe       = member.user_id === currentUserId
            const isInactive = member.status === 'inactif'
            const tasks      = workload[member.user_id] ?? 0
            const isLoading  = loading === member.id

            return (
              <div
                key={member.id}
                className={cn('flex items-center gap-4 px-5 py-3.5 transition-colors', isInactive && 'bg-gray-50/60 opacity-60')}
              >
                {/* Avatar */}
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0',
                  isInactive ? 'bg-gray-200 text-gray-400' : 'bg-auchu-100 text-auchu-700'
                )}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt={name} className="w-9 h-9 rounded-full object-cover" />
                    : getInitials(name)
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-gray-900 text-sm truncate">{name}</p>
                    {isMe && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">vous</span>}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{email}</p>
                </div>

                {/* Charge de travail */}
                {tasks > 0 && (
                  <div className="text-xs flex items-center gap-1 flex-shrink-0">
                    <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-semibold text-[10px]">
                      {tasks}
                    </span>
                  </div>
                )}

                {/* Rôle */}
                {!isMe && member.role !== 'owner' ? (
                  <div className="relative flex-shrink-0">
                    <select
                      value={member.role}
                      onChange={e => patchMember(member.id, { role: e.target.value as OrgRole })}
                      disabled={isLoading}
                      className="text-xs font-medium rounded-full pl-2.5 pr-6 py-1 border border-transparent appearance-none cursor-pointer transition-colors bg-transparent hover:border-gray-200"
                      style={{
                        color: roleCfg.cls.includes('auchu')  ? '#5254cc'
                             : roleCfg.cls.includes('blue')   ? '#1d4ed8'
                             : roleCfg.cls.includes('orange') ? '#c2410c'
                             : roleCfg.cls.includes('green')  ? '#15803d'
                             : '#4b5563'
                      }}
                    >
                      <option value="manager">Manager</option>
                      <option value="partner">Partenaire</option>
                      <option value="editor">Éditeur</option>
                      <option value="viewer">Observateur</option>
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                ) : (
                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0', roleCfg.cls)}>
                    {roleCfg.label}
                  </span>
                )}

                {/* Actions */}
                {!isMe && member.role !== 'owner' && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {isLoading
                      ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      : <>
                          <button
                            onClick={() => patchMember(member.id, { status: isInactive ? 'actif' : 'inactif' })}
                            title={isInactive ? 'Réactiver' : 'Désactiver'}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                          >
                            {isInactive ? <UserCheck className="w-3.5 h-3.5" /> : <UserMinus className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => removeMember(member.id)}
                            title="Retirer de l'équipe"
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-300 hover:text-red-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                    }
                  </div>
                )}
              </div>
            )
          })}

          {members.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              Aucun membre pour l'instant
            </div>
          )}
        </div>
      </div>

      {/* ── Invitations en attente ───────────────────────────────────────────── */}
      {invitations.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Invitations en attente
              <span className="ml-2 text-xs font-normal text-gray-400 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">{invitations.length}</span>
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {invitations.map(inv => {
              const link    = `${APP_URL}/invite/${inv.code}`
              const expired = new Date(inv.expires_at) < new Date()
              const roleCfg = ROLE_CONFIG[inv.role] ?? ROLE_CONFIG.viewer
              const isRevoking = loading === `inv-${inv.id}`

              return (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', roleCfg.cls)}>
                        {roleCfg.label}
                      </span>
                      <span className="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded tracking-widest">
                        {inv.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-gray-300" />
                      <span className={cn('text-xs', expired ? 'text-red-500' : 'text-gray-400')}>
                        {expired ? 'Expiré' : `Expire le ${formatDate(inv.expires_at)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => copyText(inv.code, `code-${inv.id}`)}
                      title="Copier le code"
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                    >
                      {copied === `code-${inv.id}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      Code
                    </button>
                    <button
                      onClick={() => copyText(link, `link-${inv.id}`)}
                      title="Copier le lien d'invitation"
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                    >
                      {copied === `link-${inv.id}` ? <Check className="w-3 h-3 text-green-500" /> : <Link2 className="w-3 h-3" />}
                      Lien
                    </button>
                    <button
                      onClick={() => revokeInvitation(inv.id)}
                      disabled={isRevoking}
                      title="Révoquer cette invitation"
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-300 hover:text-red-400 disabled:opacity-50"
                    >
                      {isRevoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
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
          {(['manager', 'partner', 'editor', 'viewer'] as const).map(role => {
            const cfg = ROLE_CONFIG[role]
            return (
              <div key={role} className="rounded-xl border border-gray-100 p-3 space-y-1.5">
                <span className={cn('inline-flex text-xs font-medium px-2 py-0.5 rounded-full', cfg.cls)}>
                  {cfg.label}
                </span>
                <p className="text-xs text-gray-500 leading-relaxed">{cfg.desc}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Modal invitation ─────────────────────────────────────────────────── */}
      {showInvite && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setShowInvite(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-50 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Inviter un membre</h3>
              <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div>
              <label className="label">Rôle du nouveau membre</label>
              <div className="space-y-2 mt-1">
                {(['manager', 'partner', 'editor', 'viewer'] as const).map(r => {
                  const cfg = ROLE_CONFIG[r]
                  return (
                    <button
                      key={r}
                      onClick={() => setNewRole(r)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all',
                        newRole === r ? 'border-auchu-400 bg-auchu-50' : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 transition-all',
                        newRole === r ? 'border-auchu-500 bg-auchu-500' : 'border-gray-300'
                      )}>
                        {newRole === r && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{cfg.label}</p>
                          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', cfg.cls)}>
                            {r}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{cfg.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
              Le lien d'invitation sera valide 7 jours. Partagez-le directement avec votre collaborateur.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowInvite(false)} className="btn-secondary flex-1">Annuler</button>
              <button
                onClick={createInvite}
                disabled={loading === 'invite'}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {loading === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Générer le lien'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
