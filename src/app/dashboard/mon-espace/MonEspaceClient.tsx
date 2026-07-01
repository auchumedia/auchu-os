'use client'

import { useState, useRef } from 'react'
import { formatDate, cn } from '@/lib/utils'
import {
  FileText, Calendar, Clock, CheckCircle, StickyNote,
  AlertTriangle, Users, Loader2, Check,
} from 'lucide-react'
import type { OrgRole } from '@/types'
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
  client: ClientRef | null
}
interface ContentRow {
  id: string
  title: string
  status: string
  scheduled_at: string | null
  client: ClientRef | null
}
interface ClientRow { id: string; name: string; company?: string | null; status?: string }

interface OwnerProps {
  isOwner: true
  userName: string
  initialNote: string
  todayTasks: ProjectRow[]
  toDelegate: ProjectRow[]
  initialClients: ClientRow[]
}
interface MemberProps {
  isOwner: false
  role: OrgRole
  userName: string
  myTasks: ProjectRow[]
  myContents: ContentRow[]
  myClients: ClientRow[]
  initialClients: ClientRow[]
}
type Props = OwnerProps | MemberProps

function DeadlineTag({ deadline }: { deadline: string | null }) {
  if (!deadline) return <span className="text-xs text-gray-300 flex-shrink-0">—</span>
  const isOverdue = new Date(deadline) < new Date(new Date().toDateString())
  return (
    <span className={cn('text-xs flex-shrink-0', isOverdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
      {formatDate(deadline)}
    </span>
  )
}

function TaskRow({ p }: { p: ProjectRow }) {
  const pc = PRIORITY_CFG[p.priority] ?? PRIORITY_CFG.normale
  const isUrgent = p.priority === 'urgente' || p.priority === 'haute'
  return (
    <div className={cn('flex items-center gap-4 bg-white border rounded-xl px-4 py-3', isUrgent ? 'border-amber-200' : 'border-gray-100')}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{p.title}</p>
        {p.client?.name && <p className="text-xs text-gray-400 mt-0.5">{p.client.name}</p>}
      </div>
      <span className={cn('text-xs font-semibold flex-shrink-0', pc.cls)}>{pc.label}</span>
      <DeadlineTag deadline={p.deadline} />
    </div>
  )
}

export default function MonEspaceClient(props: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Mon espace</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {props.isOwner
            ? `Bonjour ${props.userName} — vue d'ensemble de l'agence`
            : `Bonjour ${props.userName} — vos tâches assignées`}
        </p>
      </div>

      {props.isOwner ? <OwnerView {...props} /> : <MemberView {...props} />}
    </div>
  )
}

// ─── Vue owner ──────────────────────────────────────────────────────────────

function OwnerView({ initialNote, todayTasks, toDelegate, initialClients }: OwnerProps) {
  const [note,    setNote]    = useState(initialNote)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onNoteChange(value: string) {
    setNote(value)
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNote(value), 1000)
  }

  async function saveNote(value: string) {
    setSaving(true)
    await fetch('/api/notes', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: value }),
    })
    setSaving(false)
    setSaved(true)
  }

  return (
    <>
      {/* ── Notes personnelles ─────────────────────────────────────────────── */}
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

      {/* ── À faire aujourd'hui ──────────────────────────────────────────────── */}
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
          <div className="space-y-2">
            {todayTasks.map(p => <TaskRow key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {/* ── Tâches à déléguer ───────────────────────────────────────────────── */}
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
          <div className="space-y-2">
            {toDelegate.map(p => <TaskRow key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {/* ── Calendrier de l'agence ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Calendrier de l'agence</h2>
        </div>
        <CalendarPanel teamMode initialClients={initialClients} />
      </section>
    </>
  )
}

// ─── Vue membre ─────────────────────────────────────────────────────────────

function MemberView({ myTasks, myContents, myClients, initialClients }: MemberProps) {
  return (
    <>
      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{myTasks.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Tâches assignées</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{myContents.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Contenus à produire</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{myClients.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Clients assignés</p>
        </div>
      </div>

      {/* ── Mes tâches assignées ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Mes tâches assignées</h2>
        </div>
        {myTasks.length === 0 ? (
          <div className="card text-center py-8">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucune tâche assignée pour l'instant.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myTasks.map(p => <TaskRow key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {/* ── Mes contenus à produire ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Mes contenus à produire</h2>
          <span className="text-xs text-gray-400 ml-auto">{myContents.length} en cours</span>
        </div>
        {myContents.length === 0 ? (
          <div className="card text-center py-10">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun contenu assigné pour l'instant.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Titre</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Statut</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Planifié</th>
                </tr>
              </thead>
              <tbody>
                {myContents.map(c => {
                  const sc = STATUS_CFG[c.status] ?? STATUS_CFG.draft
                  return (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{c.client?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', sc.cls)}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {c.scheduled_at ? formatDate(c.scheduled_at) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Mes clients ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Mes clients</h2>
        </div>
        {myClients.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-sm text-gray-400">Aucun client assigné pour l'instant.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {myClients.map(c => (
              <div key={c.id} className="card p-4">
                <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                {c.company && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.company}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Mon calendrier ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Mon calendrier</h2>
        </div>
        <CalendarPanel teamMode={false} initialClients={initialClients} />
      </section>
    </>
  )
}
