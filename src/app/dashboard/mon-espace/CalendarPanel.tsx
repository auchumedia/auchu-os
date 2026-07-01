'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Config ───────────────────────────────────────────────────────────────────

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

type ViewMode    = 'month' | 'week'
type CalEvtType  = 'tournage' | 'publication' | 'reunion' | 'deadline' | 'contenu'

const TYPE_CFG: Record<CalEvtType, { label: string; bg: string; text: string; dot: string }> = {
  tournage:    { label: 'Tournage',    bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  publication: { label: 'Publication', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  reunion:     { label: 'Réunion',     bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  deadline:    { label: 'Deadline',    bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
  contenu:     { label: 'Contenu',     bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
}

interface CalEvent {
  id: string
  title: string
  date: string
  type: CalEvtType
  clientName?: string | null
  userName?: string | null
  source: 'calendar' | 'content'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date) { return d.toISOString().slice(0, 10) }

function getWeekStart(d: Date): Date {
  const date = new Date(d)
  const dow  = date.getDay()
  date.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1))
  date.setHours(0, 0, 0, 0)
  return date
}

function getMonthCells(year: number, month: number): (string | null)[] {
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toISO(new Date(year, month, i + 1))
    ),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// ─── Props ────────────────────────────────────────────────────────────────────

type CalendarScope = 'personal' | 'org' | 'own-team'

interface Props {
  scope: CalendarScope
  initialClients: { id: string; name: string }[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarPanel({ scope, initialClients }: Props) {
  const [view, setView] = useState<ViewMode>('month')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) setView('week')
  }, [])
  const [curDate, setCurDate] = useState(new Date())
  const [events,  setEvents]  = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [modal,        setModal]        = useState<string | null>(null)
  const [formTitle,    setFormTitle]    = useState('')
  const [formType,     setFormType]     = useState<CalEvtType>('tournage')
  const [formClientId, setFormClientId] = useState('')
  const [formNotes,    setFormNotes]    = useState('')
  const [saving,       setSaving]       = useState(false)

  const getRangeForView = useCallback((): [string, string] => {
    if (view === 'month') {
      const y = curDate.getFullYear(), m = curDate.getMonth()
      return [toISO(new Date(y, m, 1)), toISO(new Date(y, m + 1, 0))]
    }
    const mon = getWeekStart(curDate)
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
    return [toISO(mon), toISO(sun)]
  }, [view, curDate])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const [start, end] = getRangeForView()
    const params = new URLSearchParams({ start, end })
    if (scope === 'org') params.set('team', '1')
    if (scope === 'own-team') params.set('scope', 'own-team')
    const res  = await fetch(`/api/calendrier?${params}`)
    const json = await res.json()
    setEvents(json.events ?? [])
    setLoading(false)
  }, [getRangeForView, scope])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  function navigate(dir: 1 | -1) {
    setCurDate(prev => {
      const d = new Date(prev)
      if (view === 'month') d.setMonth(d.getMonth() + dir)
      else                  d.setDate(d.getDate() + 7 * dir)
      return d
    })
  }

  const eventsMap = events.reduce<Record<string, CalEvent[]>>((acc, e) => {
    ;(acc[e.date] ??= []).push(e)
    return acc
  }, {})

  function openModal(date: string) {
    setModal(date)
    setFormTitle(''); setFormType('tournage'); setFormClientId(''); setFormNotes('')
  }

  async function handleCreate() {
    if (!formTitle.trim() || !modal) return
    setSaving(true)
    const res = await fetch('/api/calendrier', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title: formTitle, type: formType, date: modal, client_id: formClientId || null, notes: formNotes }),
    })
    if (res.ok) { await fetchEvents(); setModal(null) }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/calendrier?id=${id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const periodLabel = view === 'month'
    ? `${MONTHS_FR[curDate.getMonth()]} ${curDate.getFullYear()}`
    : (() => {
        const mon = getWeekStart(curDate)
        const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
        return `${mon.getDate()} – ${sun.getDate()} ${MONTHS_FR[sun.getMonth()]} ${sun.getFullYear()}`
      })()

  const todayISO = toISO(new Date())

  const monthCells = view === 'month'
    ? getMonthCells(curDate.getFullYear(), curDate.getMonth())
    : []

  const weekDays = view === 'week'
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(getWeekStart(curDate))
        d.setDate(d.getDate() + i)
        return toISO(d)
      })
    : []

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {(Object.entries(TYPE_CFG) as [CalEvtType, typeof TYPE_CFG[CalEvtType]][]).map(([type, cfg]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={cn('w-2.5 h-2.5 rounded-full', cfg.dot)} />
              <span className="text-xs text-gray-500">{cfg.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button
              onClick={() => setView('month')}
              className={cn('px-3 py-1.5 transition-colors',
                view === 'month' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}
            >
              Mois
            </button>
            <button
              onClick={() => setView('week')}
              className={cn('px-3 py-1.5 transition-colors',
                view === 'week' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}
            >
              Semaine
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-900 min-w-[160px] text-center">{periodLabel}</span>
            <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Calendar grid ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      ) : view === 'month' ? (

        <div className="card overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS_FR.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((dateStr, i) => {
              const dayEvents = dateStr ? (eventsMap[dateStr] ?? []) : []
              const isToday   = dateStr === todayISO
              const isWeekend = i % 7 >= 5
              return (
                <div
                  key={i}
                  onClick={() => dateStr && openModal(dateStr)}
                  className={cn(
                    'min-h-[90px] border-b border-r border-gray-100 p-1.5 transition-colors',
                    dateStr ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50/50',
                    isWeekend && dateStr && 'bg-gray-50/30',
                    (i + 1) % 7 === 0 && 'border-r-0',
                    i >= monthCells.length - 7 && 'border-b-0',
                  )}
                >
                  {dateStr && (
                    <>
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 ml-auto',
                        isToday ? 'bg-auchu-600 text-white' : 'text-gray-700'
                      )}>
                        {parseInt(dateStr.slice(8))}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(e => {
                          const cfg = TYPE_CFG[e.type]
                          return (
                            <div
                              key={e.id}
                              onClick={ev => { ev.stopPropagation(); e.source === 'calendar' && handleDelete(e.id) }}
                              className={cn('flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight truncate group', cfg.bg, cfg.text)}
                              title={`${e.title}${e.clientName ? ` — ${e.clientName}` : ''}${e.userName ? ` (${e.userName})` : ''}\nCliquer pour supprimer`}
                            >
                              <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
                              <span className="truncate">{e.title}</span>
                            </div>
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <p className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? 's' : ''}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      ) : (

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((dateStr, i) => {
            const dayEvents = eventsMap[dateStr] ?? []
            const isToday   = dateStr === todayISO
            const day       = new Date(dateStr + 'T12:00:00')
            return (
              <div key={dateStr} className="card p-2 min-h-[220px] flex flex-col">
                <div className="text-center mb-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{DAYS_FR[i]}</p>
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold mx-auto mt-0.5',
                    isToday ? 'bg-auchu-600 text-white' : 'text-gray-800'
                  )}>
                    {day.getDate()}
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  {dayEvents.map(e => {
                    const cfg = TYPE_CFG[e.type]
                    return (
                      <div
                        key={e.id}
                        className={cn('px-2 py-1 rounded-lg text-[11px] leading-snug group relative', cfg.bg)}
                      >
                        <p className={cn('font-medium truncate', cfg.text)}>{e.title}</p>
                        {e.clientName && <p className="text-gray-500 truncate text-[10px]">{e.clientName}</p>}
                        {e.userName   && <p className="text-gray-400 truncate text-[10px]">{e.userName}</p>}
                        {e.source === 'calendar' && (
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={() => openModal(dateStr)}
                  className="mt-2 w-full flex items-center justify-center gap-1 py-1 text-[10px] text-gray-400 hover:text-auchu-600 hover:bg-auchu-50 rounded-lg transition-colors"
                >
                  <Plus className="w-3 h-3" /> Ajouter
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal création ────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                Nouvel événement — {new Date(modal + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Titre *</label>
                <input
                  autoFocus
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Ex : Tournage client X"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-auchu-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(TYPE_CFG) as [CalEvtType, typeof TYPE_CFG[CalEvtType]][])
                    .filter(([t]) => t !== 'contenu')
                    .map(([type, cfg]) => (
                      <button
                        key={type}
                        onClick={() => setFormType(type)}
                        className={cn(
                          'px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all text-left flex items-center gap-2',
                          formType === type
                            ? `${cfg.bg} ${cfg.text} border-current`
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                        {cfg.label}
                      </button>
                    ))}
                </div>
              </div>

              {initialClients.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Client (optionnel)</label>
                  <select
                    value={formClientId}
                    onChange={e => setFormClientId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-auchu-400"
                  >
                    <option value="">Aucun client</option>
                    {initialClients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optionnel)</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Détails, lieu, participants…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-auchu-400 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setModal(null)} className="flex-1 btn-secondary">
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!formTitle.trim() || saving}
                className="flex-1 btn-primary"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
