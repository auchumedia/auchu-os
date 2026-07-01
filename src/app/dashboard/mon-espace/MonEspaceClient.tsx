'use client'

import { useState, useRef } from 'react'
import { formatDate, cn, getInitials } from '@/lib/utils'
import {
  FileText, Calendar, Clock, CheckCircle, StickyNote,
  AlertTriangle, Users, Loader2, Check, UsersRound,
} from 'lucide-react'
import type { OrgRole } from '@/types'
import { ROLE_LABELS } from '@/lib/roles'
import CalendarPanel from './CalendarPanel'

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  idee:         { label: 'Idée',         cls: 'bg-gray-100  text-gray-600'   },
  en_redaction: { label: 'En rédaction', cls: 'bg-blue-100  text-blue-700'   },
  pret:         { label: 'Prêt',         cls: 'bg-amber-100 text-amber-700'  },
  approuve:     { label: 'Approuvé',     cls: 'bg-green-100 text-green-700'  },
  refuse:       { label: 'Refusé',       cls: 'bg-red-100   text-red-700'    },
  draft:        { label: 'Brouillon',    cls: 'bg-gray-100  text-gray-600'   },
  review:       { label: 'En révision',  cls: 'bg-purple-100 text-purple-700'},
  publie:       { label: 'Publié',       cls: 'bg-green-100 text-green-700'  },
}
const PRIORITY_CFG: Record<string, { label: string; cls: string }> = {
  basse:   { label: 'Basse',   cls: 'text-gray-400'  },
  normale: { label: 'Normale', cls: 'text-blue-500'  },
  haute:   { label: 'Haute',   cls: 'text-amber-500' },
  urgente: { label: 'Urgente', cls: 'text-red-500'   },
}

interface ClientRef { name: string }
interface ProjectRow {
  id: string
  title: string
  priority: string
  deadline: string | null
  assigned_to?: string | null
  client: ClientRef | null
}
interface ContentRow {
  id: string
  title: string
  status: string
  scheduled_at: string | null
  assigned_user_id?: string | null
  client: ClientRef | null
}
interface ClientRow { id: string; name: string; company?: string | null; status?: string }
interface Profile { full_name: string | null; email: string | null; avatar_url: string | null }
interface TeamMemberRow { user_id: string; role: OrgRole; profile: Profile | null }

interface OwnerProps {
  view: 'owner'
  userName: string
  initialNote: string
  todayTasks: ProjectRow[]
  toDelegate: ProjectRow[]
  initialClients: ClientRow[]
}
interface ChefProps {
  view: 'chef'
  userName: string
  teamMembers: TeamMemberRow[]
  teamClients: ClientRow[]
  teamTasks: ProjectRow[]
  teamContents: ContentRow[]
  initialClients: ClientRow[]
}
interface StrategeProps {
  view: 'stratege'
  userName: string
  teamMembers: TeamMemberRow[]
  teamClients: ClientRow[]
  myContents: ContentRow[]
  teamContentCalendar: ContentRow[]
  initialClients: ClientRow[]
}
interface MonteurProps {
  view: 'monteur'
  userName: string
  teamMembers: TeamMemberRow[]
  myTasks: ProjectRow[]
  myContents: ContentRow[]
  initialClients: ClientRow[]
}
type Props = OwnerProps | ChefProps | StrategeProps | MonteurProps

function memberName(p: Profile | null) {
  return p?.full_name || p?.email?.split('@')[0] || 'Inconnu'
}

function DeadlineTag({ deadline }: { deadline: string | null }) {
  if (!deadline) return <span className="text-xs text-gray-300 flex-shrink-0">—</span>
  const isOverdue = new Date(deadline) < new Date(new Date().toDateString())
  return (
    <span className={cn('text-xs flex-shrink-0', isOverdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
      {formatDate(deadline)}
    </span>
  )
}

function TaskRow({ p, assigneeName }: { p: ProjectRow; assigneeName?: string }) {
  const pc = PRIORITY_CFG[p.priority] ?? PRIORITY_CFG.normale
  const isUrgent = p.priority === 'urgente' || p.priority === 'haute'
  return (
    <div className={cn('flex items-center gap-4 bg-white border rounded-xl px-4 py-3', isUrgent ? 'border-amber-200' : 'border-gray-100')}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{p.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {p.client?.name}{p.client?.name && assigneeName ? ' · ' : ''}{assigneeName}
        </p>
      </div>
      <span className={cn('text-xs font-semibold flex-shrink-0', pc.cls)}>{pc.label}</span>
      <DeadlineTag deadline={p.deadline} />
    </div>
  )
}

function ContentTable({ contents, assigneeNameFor }: { contents: ContentRow[]; assigneeNameFor?: (id: string | null | undefined) => string }) {
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Titre</th>
            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Client</th>
            {assigneeNameFor && <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Assigné à</th>}
            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Statut</th>
            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Planifié</th>
          </tr>
        </thead>
        <tbody>
          {contents.map(c => {
            const sc = STATUS_CFG[c.status] ?? STATUS_CFG.draft
            return (
              <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{c.client?.name ?? '—'}</td>
                {assigneeNameFor && <td className="px-4 py-3 text-xs text-gray-500">{assigneeNameFor(c.assigned_user_id)}</td>}
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', sc.cls)}>{sc.label}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{c.scheduled_at ? formatDate(c.scheduled_at) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TeamRoster({ members }: { members: TeamMemberRow[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {members.map(m => {
        const name = memberName(m.profile)
        const roleCfg = ROLE_LABELS[m.role]
        return (
          <div key={m.user_id} className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-auchu-100 text-auchu-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {m.profile?.avatar_url
                ? <img src={m.profile.avatar_url} alt={name} className="w-8 h-8 rounded-full object-cover" />
                : getInitials(name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', roleCfg.cls)}>{roleCfg.label}</span>
            </div>
          </div>
        )
      })}
      {members.length === 0 && <p className="text-sm text-gray-400 col-span-full">Aucun membre dans l'équipe.</p>}
    </div>
  )
}

export default function MonEspaceClient(props: Props) {
  const subtitle = {
    owner:    `Bonjour ${props.userName} — vue d'ensemble de l'agence`,
    chef:     `Bonjour ${props.userName} — votre équipe`,
    stratege: `Bonjour ${props.userName} — vos clients et livrables`,
    monteur:  `Bonjour ${props.userName} — vos projets vidéo`,
  }[props.view]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Mon espace</h1>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      {props.view === 'owner'    && <OwnerView {...props} />}
      {props.view === 'chef'     && <ChefView {...props} />}
      {props.view === 'stratege' && <StrategeView {...props} />}
      {props.view === 'monteur'  && <MonteurView {...props} />}
    </div>
  )
}

// ─── Vue owner / director ──────────────────────────────────────────────────

function OwnerView({ initialNote, todayTasks, toDelegate, initialClients }: OwnerProps) {
  const [note,   setNote]   = useState(initialNote)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onNoteChange(value: string) {
    setNote(value)
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNote(value), 1000)
  }

  async function saveNote(value: string) {
    setSaving(true)
    await fetch('/api/notes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: value }) })
    setSaving(false)
    setSaved(true)
  }

  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-3">
          <StickyNote className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Mes notes</h2>
          <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
            {saving
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Sauvegarde…</>
              : saved && note && <><Check className="w-3 h-3 text-green-500" /> Sauvegardé</>}
          </span>
        </div>
        <textarea
          value={note}
          onChange={e => onNoteChange(e.target.value)}
          onBlur={() => saveNote(note)}
          rows={4}
          placeholder="Notez ici vos rappels, idées, priorités du moment…"
          className="w-full card resize-y text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-auchu-400"
        />
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">À faire aujourd'hui</h2>
          <span className="text-xs text-gray-400 ml-auto">{todayTasks.length} deadline{todayTasks.length !== 1 ? 's' : ''}</span>
        </div>
        {todayTasks.length === 0 ? (
          <div className="card text-center py-8">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Rien d'urgent aujourd'hui.</p>
          </div>
        ) : (
          <div className="space-y-2">{todayTasks.map(p => <TaskRow key={p.id} p={p} />)}</div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-gray-900">Tâches urgentes à déléguer</h2>
          <span className="text-xs text-gray-400 ml-auto">{toDelegate.length} non assignée{toDelegate.length !== 1 ? 's' : ''}</span>
        </div>
        {toDelegate.length === 0 ? (
          <div className="card text-center py-8">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucune tâche urgente en attente d'assignation.</p>
          </div>
        ) : (
          <div className="space-y-2">{toDelegate.map(p => <TaskRow key={p.id} p={p} />)}</div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Calendrier de l'agence</h2>
        </div>
        <CalendarPanel scope="org" initialClients={initialClients} />
      </section>
    </>
  )
}

// ─── Vue chef_equipe ────────────────────────────────────────────────────────

function ChefView({ teamMembers, teamClients, teamTasks, teamContents, initialClients }: ChefProps) {
  const nameByUserId = new Map(teamMembers.map(m => [m.user_id, memberName(m.profile)]))

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p><p className="text-xs text-gray-500 mt-0.5">Membres</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-gray-900">{teamClients.length}</p><p className="text-xs text-gray-500 mt-0.5">Clients</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-gray-900">{teamTasks.length}</p><p className="text-xs text-gray-500 mt-0.5">Tâches en cours</p></div>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4"><UsersRound className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Mon équipe</h2></div>
        <TeamRoster members={teamMembers} />
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Tâches de l'équipe</h2></div>
        {teamTasks.length === 0 ? (
          <div className="card text-center py-8"><CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" /><p className="text-sm text-gray-400">Aucune tâche en cours.</p></div>
        ) : (
          <div className="space-y-2">{teamTasks.map(p => <TaskRow key={p.id} p={p} assigneeName={nameByUserId.get(p.assigned_to ?? '')} />)}</div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><FileText className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Contenus de l'équipe</h2></div>
        {teamContents.length === 0 ? (
          <div className="card text-center py-8"><CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" /><p className="text-sm text-gray-400">Aucun contenu en cours.</p></div>
        ) : (
          <ContentTable contents={teamContents} assigneeNameFor={id => nameByUserId.get(id ?? '') ?? '—'} />
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><Calendar className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Calendrier de l'équipe</h2></div>
        <CalendarPanel scope="own-team" initialClients={initialClients} />
      </section>
    </>
  )
}

// ─── Vue stratège ───────────────────────────────────────────────────────────

function StrategeView({ teamMembers, teamClients, myContents, teamContentCalendar, initialClients }: StrategeProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-gray-900">{teamClients.length}</p><p className="text-xs text-gray-500 mt-0.5">Clients de l'équipe</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-gray-900">{myContents.length}</p><p className="text-xs text-gray-500 mt-0.5">Mes livrables</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p><p className="text-xs text-gray-500 mt-0.5">Membres de l'équipe</p></div>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Clients de l'équipe</h2></div>
        {teamClients.length === 0 ? (
          <div className="card text-center py-8"><p className="text-sm text-gray-400">Aucun client assigné à votre équipe pour l'instant.</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {teamClients.map(c => (
              <div key={c.id} className="card p-4">
                <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                {c.company && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.company}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><FileText className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Mes livrables</h2></div>
        {myContents.length === 0 ? (
          <div className="card text-center py-10"><CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" /><p className="text-sm text-gray-400">Aucun livrable assigné pour l'instant.</p></div>
        ) : (
          <ContentTable contents={myContents} />
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><Calendar className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Calendrier de contenu de l'équipe</h2></div>
        {teamContentCalendar.length === 0 ? (
          <div className="card text-center py-8"><p className="text-sm text-gray-400">Aucun contenu planifié pour l'équipe.</p></div>
        ) : (
          <div className="space-y-2">
            {teamContentCalendar.map(c => (
              <div key={c.id} className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{c.title}</p>
                  {c.client?.name && <p className="text-xs text-gray-400 mt-0.5">{c.client.name}</p>}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{c.scheduled_at ? formatDate(c.scheduled_at) : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><Calendar className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Mon calendrier</h2></div>
        <CalendarPanel scope="personal" initialClients={initialClients} />
      </section>
    </>
  )
}

// ─── Vue monteur ────────────────────────────────────────────────────────────

function MonteurView({ teamMembers, myTasks, myContents, initialClients }: MonteurProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-gray-900">{myTasks.length}</p><p className="text-xs text-gray-500 mt-0.5">Projets assignés</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-gray-900">{myContents.length}</p><p className="text-xs text-gray-500 mt-0.5">Fichiers à monter</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p><p className="text-xs text-gray-500 mt-0.5">Membres de l'équipe</p></div>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Mes projets vidéo</h2></div>
        {myTasks.length === 0 ? (
          <div className="card text-center py-8"><CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" /><p className="text-sm text-gray-400">Aucun projet assigné pour l'instant.</p></div>
        ) : (
          <div className="space-y-2">{myTasks.map(p => <TaskRow key={p.id} p={p} />)}</div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><FileText className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Fichiers à monter</h2></div>
        {myContents.length === 0 ? (
          <div className="card text-center py-10"><CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" /><p className="text-sm text-gray-400">Aucun fichier assigné pour l'instant.</p></div>
        ) : (
          <ContentTable contents={myContents} />
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><UsersRound className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Mon équipe</h2></div>
        <TeamRoster members={teamMembers} />
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4"><Calendar className="w-4 h-4 text-auchu-500" /><h2 className="font-semibold text-gray-900">Mon calendrier</h2></div>
        <CalendarPanel scope="personal" initialClients={initialClients} />
      </section>
    </>
  )
}
