'use client'

import { useState } from 'react'
import { Plus, X, Loader2, MapPin, Users, Video, Send } from 'lucide-react'
import { CalendarEvent, ContentPiece } from '@/types'
import { cn, formatDate } from '@/lib/utils'

// ─── Config ───────────────────────────────────────────────────────────────────

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  linkedin: 'LinkedIn', google: 'Google Ads', meta: 'Meta Ads',
}
const PLATFORMS = ['instagram','facebook','tiktok','linkedin','google','meta']

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialEvents:  CalendarEvent[]
  contentPieces:  ContentPiece[]
  clientId:       string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarView({ initialEvents, contentPieces, clientId }: Props) {
  const [viewType, setViewType] = useState<'tournage' | 'publication'>('tournage')
  const [viewDate, setViewDate] = useState(new Date())
  const [events, setEvents]     = useState<CalendarEvent[]>(initialEvents)
  const [showAdd, setShowAdd]   = useState(false)

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const today        = new Date()
  const isThisMonth  = today.getFullYear() === year && today.getMonth() === month

  // Filter events for current view type + month
  const monthEvents = events.filter(e => {
    if (e.type !== viewType) return false
    const d = new Date(e.date)
    return d.getFullYear() === year && d.getMonth() === month
  })

  // Also show content_pieces with scheduled_at in publication view
  const monthContent = viewType === 'publication'
    ? contentPieces.filter(c => {
        if (!c.scheduled_at) return false
        const d = new Date(c.scheduled_at)
        return d.getFullYear() === year && d.getMonth() === month
      })
    : []

  // Group by day
  const eventsByDay: Record<number, CalendarEvent[]> = {}
  monthEvents.forEach(e => {
    const day = new Date(e.date).getDate()
    if (!eventsByDay[day]) eventsByDay[day] = []
    eventsByDay[day].push(e)
  })

  const contentByDay: Record<number, ContentPiece[]> = {}
  monthContent.forEach(c => {
    const day = new Date(c.scheduled_at!).getDate()
    if (!contentByDay[day]) contentByDay[day] = []
    contentByDay[day].push(c)
  })

  const deleteEvent = async (id: string) => {
    await fetch(`/api/evenements/${id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  // Color schemes
  const isTournage = viewType === 'tournage'
  const eventBg   = isTournage ? 'bg-blue-100 text-blue-800'   : 'bg-coral-50 text-coral-700'
  const eventBgStyle = isTournage
    ? { background: '#dbeafe', color: '#1e40af' }
    : { background: '#fff1f0', color: '#f95640' }

  return (
    <div className="space-y-4">
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setViewType('tournage')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              viewType === 'tournage'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Video className="w-3.5 h-3.5" />
            Tournage
          </button>
          <button
            onClick={() => setViewType('publication')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              viewType === 'publication'
                ? 'bg-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
            style={viewType === 'publication' ? { color: '#f95640' } : undefined}
          >
            <Send className="w-3.5 h-3.5" />
            Publication
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{MONTHS_FR[month]} {year}</span>
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="btn-secondary py-1.5 px-3 text-sm"
          >←</button>
          <button
            onClick={() => setViewDate(new Date())}
            className="btn-secondary py-1.5 px-3 text-sm"
          >Aujourd'hui</button>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="btn-secondary py-1.5 px-3 text-sm"
          >→</button>
          <button
            onClick={() => setShowAdd(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-all',
            )}
            style={{ background: isTournage ? '#3b82f6' : '#f95640' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        {viewType === 'tournage' && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-200 inline-block" />
            Séance de tournage
          </span>
        )}
        {viewType === 'publication' && (
          <>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded inline-block" style={{ background: '#ffd5d0' }} />
              Événement de publication
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-pink-100 inline-block" />
              Contenu planifié
            </span>
          </>
        )}
      </div>

      {/* Calendar grid */}
      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAYS_FR.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="min-h-[100px] bg-gray-50/40" />
            const dayEvents  = eventsByDay[day]  ?? []
            const dayContent = contentByDay[day] ?? []
            const isToday    = isThisMonth && day === today.getDate()
            const hasItems   = dayEvents.length > 0 || dayContent.length > 0

            return (
              <div
                key={i}
                className={cn('min-h-[100px] p-1.5', isToday && (isTournage ? 'bg-blue-50/40' : 'bg-orange-50/40'), hasItems && 'bg-white')}
              >
                <span className={cn(
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                  isToday ? 'text-white' : 'text-gray-500'
                )}
                style={isToday ? { background: isTournage ? '#3b82f6' : '#f95640' } : undefined}
                >
                  {day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.map(ev => (
                    <EventChip
                      key={ev.id}
                      label={ev.title}
                      sublabel={ev.location ?? (ev.participants?.join(', ') ?? '')}
                      style={eventBgStyle}
                      onDelete={() => deleteEvent(ev.id)}
                    />
                  ))}
                  {dayContent.map(c => (
                    <EventChip
                      key={c.id}
                      label={c.title}
                      sublabel={PLATFORM_LABELS[c.platform] ?? c.platform}
                      style={{ background: '#fce7f3', color: '#be185d' }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add event modal */}
      {showAdd && (
        <AddEventModal
          clientId={clientId}
          type={viewType}
          contentPieces={contentPieces}
          onClose={() => setShowAdd(false)}
          onCreated={ev => {
            setEvents(prev => [...prev, ev])
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Event chip ───────────────────────────────────────────────────────────────

function EventChip({
  label, sublabel, style, onDelete,
}: {
  label: string
  sublabel?: string
  style: React.CSSProperties
  onDelete?: () => void
}) {
  return (
    <div
      className="group relative text-[10px] px-1.5 py-1 rounded font-medium leading-tight"
      style={style}
      title={sublabel ? `${label} — ${sublabel}` : label}
    >
      <div className="truncate">{label}</div>
      {sublabel && <div className="truncate opacity-70">{sublabel}</div>}
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-0.5 right-0.5 hidden group-hover:flex w-3.5 h-3.5 items-center justify-center rounded bg-black/20 hover:bg-black/40"
        >
          <X className="w-2 h-2 text-white" />
        </button>
      )}
    </div>
  )
}

// ─── Add event modal ──────────────────────────────────────────────────────────

function AddEventModal({
  clientId, type, contentPieces, onClose, onCreated,
}: {
  clientId: string
  type: 'tournage' | 'publication'
  contentPieces: ContentPiece[]
  onClose: () => void
  onCreated: (ev: CalendarEvent) => void
}) {
  const [form, setForm] = useState({
    title: '', date: '',
    location: '', participants: '',
    platform: 'instagram', content_piece_id: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const isTournage = type === 'tournage'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.date) return
    setSaving(true)
    setError(null)

    const body: Record<string, unknown> = {
      client_id: clientId,
      type,
      title: form.title,
      date:  form.date,
      notes: form.notes || null,
    }

    if (isTournage) {
      body.location     = form.location     || null
      body.participants = form.participants
        ? form.participants.split(',').map(s => s.trim()).filter(Boolean)
        : null
    } else {
      body.platform          = form.platform          || null
      body.content_piece_id  = form.content_piece_id  || null
    }

    const res = await fetch('/api/evenements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Erreur'); setSaving(false); return }
    onCreated(json.data)
  }

  const accentColor = isTournage ? '#3b82f6' : '#f95640'

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-x-0 top-1/2 -translate-y-1/2 mx-auto max-w-md w-full bg-white rounded-2xl shadow-2xl z-50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {isTournage
              ? <Video className="w-4 h-4 text-blue-500" />
              : <Send className="w-4 h-4" style={{ color: '#f95640' }} />
            }
            <h3 className="font-semibold text-gray-900">
              {isTournage ? 'Ajouter un tournage' : 'Ajouter une publication'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Titre *</label>
            <input
              type="text" required value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input text-sm"
              placeholder={isTournage ? 'Shooting Instagram Janvier' : 'Publication lancement produit'}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Date *</label>
            <input
              type="date" required value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="input text-sm"
            />
          </div>

          {isTournage ? (
            <>
              <div>
                <label className="label">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  Lieu
                </label>
                <input
                  type="text" value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="input text-sm"
                  placeholder="Studio, adresse…"
                />
              </div>
              <div>
                <label className="label">
                  <Users className="w-3 h-3 inline mr-1" />
                  Participants (séparés par virgule)
                </label>
                <input
                  type="text" value={form.participants}
                  onChange={e => setForm(f => ({ ...f, participants: e.target.value }))}
                  className="input text-sm"
                  placeholder="Jean, Marie, Kevin…"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label">Plateforme</label>
                <select
                  value={form.platform}
                  onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                  className="select text-sm"
                >
                  {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Contenu lié (optionnel)</label>
                <select
                  value={form.content_piece_id}
                  onChange={e => setForm(f => ({ ...f, content_piece_id: e.target.value }))}
                  className="select text-sm"
                >
                  <option value="">— Aucun —</option>
                  {contentPieces.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="label">Notes</label>
            <textarea
              rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="input text-sm resize-none"
              placeholder="Informations supplémentaires…"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button
              type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: accentColor }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
