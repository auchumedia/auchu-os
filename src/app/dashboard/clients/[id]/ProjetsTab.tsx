'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Plus, X, ChevronRight, ChevronLeft, Loader2, ThumbsUp, ThumbsDown, Trash2,
  ExternalLink, Link2, Check, GripVertical, Video, Send, MapPin, Users,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ContentPiece, ContentStatus, CalendarEvent, ReferenceLink } from '@/types'
import { cn } from '@/lib/utils'
import RichTextEditor from '@/components/RichTextEditor'

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  video_organique: 'Vidéo organique',
  post: 'Post', reel: 'Reel', story: 'Story', script_video: 'Script vidéo', ad: 'Ad',
  caption: 'Caption', script: 'Script', email: 'Email',
}
// Options du formulaire de création — les autres valeurs restent affichables
// (TYPE_LABELS) pour les contenus existants créés avant ce changement.
const TYPES = ['video_organique','story','ad']

const PLATFORM_LABELS: Record<string, string> = {
  toutes: 'Toutes les plateformes',
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  linkedin: 'LinkedIn', google: 'Google Ads', meta: 'Meta Ads',
}
const PLATFORMS = ['toutes','instagram','facebook','tiktok','linkedin','meta']
const CALENDAR_PLATFORMS = ['instagram','facebook','tiktok','linkedin','google','meta']

const PLATFORM_COLORS: Record<string, string> = {
  toutes:    'bg-auchu-100 text-auchu-700',
  instagram: 'bg-pink-100 text-pink-700',
  facebook:  'bg-blue-100 text-blue-700',
  tiktok:    'bg-slate-100 text-slate-700',
  linkedin:  'bg-sky-100 text-sky-700',
  google:    'bg-amber-100 text-amber-700',
  meta:      'bg-indigo-100 text-indigo-700',
}

// Workflow complet — l'ordre reflète la progression attendue d'une idée.
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  idee:         { label: 'Idée',         cls: 'bg-gray-100   text-gray-600'   },
  en_redaction: { label: 'En rédaction', cls: 'bg-blue-100   text-blue-700'   },
  pret:         { label: 'Prêt',         cls: 'bg-amber-100  text-amber-700'  },
  approuve:     { label: 'Approuvé',     cls: 'bg-green-100  text-green-700'  },
  refuse:       { label: 'Refusé',       cls: 'bg-red-100    text-red-700'    },
  filme:        { label: 'Filmé',        cls: 'bg-purple-100 text-purple-700' },
  publie:       { label: 'Publié',       cls: 'bg-indigo-100 text-indigo-700' },
}
const STATUSES: ContentStatus[] = ['idee','en_redaction','pret','approuve','refuse','filme','publie']
// Statuts qui comptent comme "livrable produit" pour le compteur du mois.
const DONE_STATUSES: ContentStatus[] = ['approuve','filme','publie']
// Statuts affichés dans le calendrier de publication (contenu confirmé).
const SCHEDULABLE_STATUSES: ContentStatus[] = ['approuve','filme']

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

// Reference links config
const REF_PLATFORMS: Record<string, { label: string; bg: string; color: string; emoji: string }> = {
  instagram: { label: 'Instagram', bg: '#fce7f3', color: '#be185d', emoji: '📸' },
  tiktok:    { label: 'TikTok',    bg: '#f1f5f9', color: '#0f172a', emoji: '🎵' },
  youtube:   { label: 'YouTube',   bg: '#fee2e2', color: '#dc2626', emoji: '▶' },
  facebook:  { label: 'Facebook',  bg: '#dbeafe', color: '#1d4ed8', emoji: '👥' },
  linkedin:  { label: 'LinkedIn',  bg: '#e0f2fe', color: '#0284c7', emoji: '💼' },
  x:         { label: 'X / Twitter', bg: '#f1f5f9', color: '#0f172a', emoji: '𝕏' },
  web:       { label: 'Lien web',  bg: '#f3f4f6', color: '#374151', emoji: '🔗' },
}

function detectPlatform(url: string): string {
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('tiktok.com'))    return 'tiktok'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook'
  if (url.includes('linkedin.com'))  return 'linkedin'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'x'
  return 'web'
}

function getYouTubeThumbnail(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null
}

// ─── Dates — parsing sans décalage de fuseau ─────────────────────────────────
// `new Date("2026-07-01")` est interprété comme minuit UTC ; un `.getMonth()`
// lu ensuite en heure locale (ex: EDT, UTC-4) le fait basculer sur le 30 juin.
// Pour toute donnée "calendaire" (month_target, scheduled_at, date d'un
// événement), on lit donc directement les composantes Y/M/D dans la chaîne
// plutôt que de passer par les getters locaux d'un objet Date.
function parseISODateParts(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

function isSameYearMonth(dateStr: string, year: number, month: number): boolean {
  const p = parseISODateParts(dateStr)
  return p.year === year && p.month === month
}

function dayOfMonth(dateStr: string): number {
  return parseISODateParts(dateStr).day
}

function formatDateOnly(dateStr: string): string {
  const { year, month, day } = parseISODateParts(dateStr)
  return `${day} ${MONTHS_FR[month].slice(0, 3)} ${year}`
}

// ─── Mois effectif d'une idée ───────────────────────────────────────────────
// scheduled_at prime, puis month_target (ciblage explicite d'un mois futur/
// passé sans date précise), puis à défaut le mois de création.
function getEffectiveDateStr(item: ContentPiece): string {
  return item.scheduled_at ?? item.month_target ?? item.created_at
}

function filterByMonth(list: ContentPiece[], year: number, month: number): ContentPiece[] {
  return list.filter(i => isSameYearMonth(getEffectiveDateStr(i), year, month))
}

function monthStartISO(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}

// ─── Auto-save hook ───────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// onSave doit renvoyer `false` (pas throw) sur échec — patchItem() résout
// toujours plutôt que de rejeter (fetch ne rejette que sur erreur réseau),
// donc un `await onSave(value)` qui ignore la valeur de retour masquait un
// PATCH refusé par l'API/RLS.
function useAutoSave(
  value: string,
  onSave: (v: string) => Promise<boolean>,
  delay = 1000
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timer    = useRef<ReturnType<typeof setTimeout>>()
  const savedVal = useRef(value)
  const mounted  = useRef(false)

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (value === savedVal.current) return
    setStatus('idle')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setStatus('saving')
      const ok = await onSave(value)
      if (!ok) {
        setStatus('error')
        return
      }
      savedVal.current = value
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    }, delay)
    return () => clearTimeout(timer.current)
  }, [value, onSave, delay])

  return status
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialContent: ContentPiece[]
  initialEvents:  CalendarEvent[]
  clientId: string
  teamMembers: { id: string; name: string }[]
  deliverablesTotal: number
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjetsTab({ initialContent, initialEvents, clientId, teamMembers, deliverablesTotal }: Props) {
  const [items, setItems]       = useState<ContentPiece[]>(initialContent)
  const [events, setEvents]     = useState<CalendarEvent[]>(initialEvents)
  const [selected, setSelected] = useState<ContentPiece | null>(null)
  const [showAdd, setShowAdd]   = useState(false)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [calType, setCalType]   = useState<'tournage' | 'publication'>('tournage')

  const now = new Date()
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthItems = filterByMonth(items, year, month)

  // ── Compteur de livrables ────────────────────────────────────────────────
  const doneCount = monthItems.filter(i => DONE_STATUSES.includes(i.status)).length
  const remaining = Math.max(deliverablesTotal - doneCount, 0)
  const pct = deliverablesTotal > 0 ? Math.min(100, Math.round((doneCount / deliverablesTotal) * 100)) : 0

  const openItem   = (item: ContentPiece) => setSelected(item)
  const closePanel = () => setSelected(null)

  const patchItem = useCallback(async (id: string, fields: Partial<ContentPiece>) => {
    const res = await fetch(`/api/contenus/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (res.ok) {
      const { data } = await res.json()
      setItems(prev => prev.map(i => i.id === id ? data : i))
      setSelected(prev => prev?.id === id ? data : prev)
    } else {
      const err = await res.json().catch(() => null)
      console.error('[ProjetsTab] PATCH échoué —', 'content_id:', id, '| fields:', Object.keys(fields), '| status:', res.status, '| error:', err)
    }
    return res.ok
  }, [])

  const deleteItem = async (id: string) => {
    if (!confirm('Supprimer ce contenu ?')) return
    const res = await fetch(`/api/contenus/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      console.error('[ProjetsTab] DELETE échoué —', 'content_id:', id, '| status:', res.status, '| error:', err)
      alert(err?.error ?? 'Suppression impossible.')
      return
    }
    setItems(prev => prev.filter(i => i.id !== id))
    if (selected?.id === id) closePanel()
  }

  const deleteEvent = async (id: string) => {
    await fetch(`/api/evenements/${id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  // ── Drag & drop reorder — restreint aux idées du mois affiché ────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems(prev => {
      const subset = filterByMonth(prev, year, month)
      const oldIndex = subset.findIndex(i => i.id === active.id)
      const newIndex = subset.findIndex(i => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const reordered = arrayMove(subset, oldIndex, newIndex)
      const subsetIds = new Set(subset.map(i => i.id))
      const slots: number[] = []
      prev.forEach((it, idx) => { if (subsetIds.has(it.id)) slots.push(idx) })
      const next = [...prev]
      slots.forEach((slotIdx, i) => { next[slotIdx] = reordered[i] })
      slots.forEach((slotIdx, i) => {
        if (next[slotIdx].position !== slotIdx) patchItem(next[slotIdx].id, { position: slotIdx })
      })
      return next
    })
  }

  // ── Calendrier — grille du mois affiché ──────────────────────────────────
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isThisMonth = now.getFullYear() === year && now.getMonth() === month

  const monthEvents = events.filter(e => e.type === calType && isSameYearMonth(e.date, year, month))

  // Seuls les contenus approuvés/filmés apparaissent au calendrier, et
  // uniquement via leur date exacte (scheduled_at) — pas month_target, qui
  // n'a pas de granularité journalière.
  const scheduledContent = calType === 'publication'
    ? items.filter(c => c.scheduled_at && SCHEDULABLE_STATUSES.includes(c.status) && isSameYearMonth(c.scheduled_at, year, month))
    : []

  const eventsByDay: Record<number, CalendarEvent[]> = {}
  monthEvents.forEach(e => {
    const day = dayOfMonth(e.date)
    if (!eventsByDay[day]) eventsByDay[day] = []
    eventsByDay[day].push(e)
  })

  const contentByDay: Record<number, ContentPiece[]> = {}
  scheduledContent.forEach(c => {
    const day = dayOfMonth(c.scheduled_at!)
    if (!contentByDay[day]) contentByDay[day] = []
    contentByDay[day].push(c)
  })

  const isTournage = calType === 'tournage'
  const eventBgStyle = isTournage
    ? { background: '#dbeafe', color: '#1e40af' }
    : { background: '#fff1f0', color: '#f95640' }

  return (
    <div className="relative space-y-8">

      {/* ─── Sélecteur de mois + compteur de livrables ───────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="btn-secondary py-1.5 px-2.5 text-sm">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={month}
              onChange={e => setViewDate(new Date(year, Number(e.target.value), 1))}
              className="select text-sm w-auto"
            >
              {MONTHS_FR.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select
              value={year}
              onChange={e => setViewDate(new Date(Number(e.target.value), month, 1))}
              className="select text-sm w-auto"
            >
              {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="btn-secondary py-1.5 px-2.5 text-sm">
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isThisMonth && (
              <button onClick={() => setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))} className="btn-secondary py-1.5 px-3 text-sm">
                Aujourd'hui
              </button>
            )}
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Ajouter un contenu
          </button>
        </div>

        {deliverablesTotal > 0 && (
          <div className="card">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                {doneCount}/{deliverablesTotal} contenu{deliverablesTotal !== 1 ? 's' : ''} ce mois
              </p>
              <span className="text-xs text-gray-400">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-auchu-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {remaining > 0
                ? `Il reste ${remaining} contenu${remaining !== 1 ? 's' : ''} à créer`
                : 'Objectif du mois atteint 🎉'}
            </p>
          </div>
        )}
      </div>

      {/* ─── Section idées ────────────────────────────────────────────────── */}
      <div>
        <p className="text-sm text-gray-500 mb-3">
          {monthItems.length} idée{monthItems.length !== 1 ? 's' : ''} — {MONTHS_FR[month]} {year}
        </p>

        {monthItems.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400 text-sm">Aucune idée pour ce mois — crée la première</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-8" />
                      <th>Titre</th>
                      <th>Type</th>
                      <th>Plateforme</th>
                      <th>Statut</th>
                      <th>Assigné à</th>
                      <th>Planifié</th>
                      <th />
                    </tr>
                  </thead>
                  <SortableContext items={monthItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {monthItems.map(item => (
                        <SortableRow key={item.id} item={item} onOpen={openItem} onDelete={deleteItem} />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>
            </div>
          </div>
        )}
      </div>

      {/* ─── Section calendrier ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setCalType('tournage')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                calType === 'tournage' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Video className="w-3.5 h-3.5" />
              Tournage
            </button>
            <button
              onClick={() => setCalType('publication')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                calType === 'publication' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
              style={calType === 'publication' ? { color: '#f95640' } : undefined}
            >
              <Send className="w-3.5 h-3.5" />
              Publication
            </button>
          </div>
          <button
            onClick={() => setShowAddEvent(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-all"
            style={{ background: isTournage ? '#3b82f6' : '#f95640' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          {calType === 'tournage' && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-200 inline-block" />
              Séance de tournage
            </span>
          )}
          {calType === 'publication' && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded inline-block" style={{ background: '#ffd5d0' }} />
                Événement de publication
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-pink-100 inline-block" />
                Contenu approuvé / filmé
              </span>
            </>
          )}
        </div>

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
              const isToday    = isThisMonth && day === now.getDate()
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
      </div>

      {/* Vue plein écran du concept */}
      {selected && (
        <ContentPanel
          key={selected.id}
          item={selected}
          teamMembers={teamMembers}
          onPatch={(fields) => patchItem(selected.id, fields)}
          onClose={closePanel}
          onDelete={() => deleteItem(selected.id)}
        />
      )}

      {/* Add content modal */}
      {showAdd && (
        <AddContentModal
          clientId={clientId}
          selectedYear={year}
          selectedMonth={month}
          onClose={() => setShowAdd(false)}
          onCreated={item => {
            setItems(prev => [...prev, item])
            setShowAdd(false)
            setSelected(item) // ouvre directement la vue plein écran pour écrire description/script
          }}
        />
      )}

      {/* Add event modal */}
      {showAddEvent && (
        <AddEventModal
          clientId={clientId}
          type={calType}
          contentPieces={items}
          onClose={() => setShowAddEvent(false)}
          onCreated={ev => {
            setEvents(prev => [...prev, ev])
            setShowAddEvent(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Sortable row ───────────────────────────────────────────────────────────────

function SortableRow({
  item, onOpen, onDelete,
}: {
  item: ContentPiece
  onOpen: (item: ContentPiece) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.idee

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="cursor-pointer hover:bg-gray-50/80 transition-colors group"
      onClick={() => onOpen(item)}
    >
      <td onClick={e => e.stopPropagation()} className="px-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500 touch-none"
          title="Glisser pour réordonner"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="font-medium text-gray-900 max-w-[200px]">
        <div className="flex items-center gap-2">
          <span className="truncate">{item.title}</span>
          {item.reference_links?.length > 0 && (
            <span title={`${item.reference_links.length} référence(s)`}>
              <Link2 className="w-3 h-3 text-gray-300 flex-shrink-0" />
            </span>
          )}
        </div>
      </td>
      <td className="text-xs text-gray-500">{TYPE_LABELS[item.type] ?? item.type}</td>
      <td>
        <span className={cn('badge text-xs', PLATFORM_COLORS[item.platform] ?? 'badge-gray')}>
          {PLATFORM_LABELS[item.platform] ?? item.platform}
        </span>
      </td>
      <td><span className={cn('badge text-xs', sc.cls)}>{sc.label}</span></td>
      <td className="text-xs text-gray-500">{item.assigned_to ?? '—'}</td>
      <td className="text-xs text-gray-400">{item.scheduled_at ? formatDateOnly(item.scheduled_at) : '—'}</td>
      <td onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        </div>
      </td>
    </tr>
  )
}

// ─── Content panel (vue plein écran) ─────────────────────────────────────────────

function ContentPanel({
  item, teamMembers, onPatch, onClose, onDelete,
}: {
  item: ContentPiece
  teamMembers: { id: string; name: string }[]
  onPatch: (fields: Partial<ContentPiece>) => Promise<boolean>
  onClose: () => void
  onDelete: () => void
}) {
  const [title,       setTitle]       = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [script,      setScript]      = useState(item.script ?? '')
  const [status,      setStatus]      = useState(item.status)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [refs,        setRefs]        = useState<ReferenceLink[]>(item.reference_links ?? [])

  // Date de publication et assignation — édition immédiate (pas de debounce,
  // ce sont des sélections ponctuelles, pas de la saisie continue).
  const [scheduledAt,     setScheduledAt]     = useState(item.scheduled_at?.slice(0, 10) ?? '')
  const [assignedTo,      setAssignedTo]      = useState(item.assigned_to ?? '')
  const [scheduleStatus,  setScheduleStatus]  = useState<SaveStatus>('idle')
  const [assignStatus,    setAssignStatus]    = useState<SaveStatus>('idle')

  const titleStatus = useAutoSave(title,       v => onPatch({ title: v }))
  const descStatus  = useAutoSave(description, v => onPatch({ description: v || null }))
  const scriptStatus = useAutoSave(script,     v => onPatch({ script: v || null, body: v || '' }))

  // Any field saving indicator
  const anyStatus = [titleStatus, descStatus, scriptStatus, scheduleStatus, assignStatus].find(s => s !== 'idle') ?? 'idle'

  const changeScheduledAt = async (v: string) => {
    setScheduledAt(v)
    setScheduleStatus('saving')
    const ok = await onPatch({ scheduled_at: v || null })
    setScheduleStatus(ok ? 'saved' : 'error')
    if (ok) setTimeout(() => setScheduleStatus('idle'), 2000)
  }

  const changeAssignedTo = async (v: string) => {
    setAssignedTo(v)
    setAssignStatus('saving')
    const ok = await onPatch({ assigned_to: v || null })
    setAssignStatus(ok ? 'saved' : 'error')
    if (ok) setTimeout(() => setAssignStatus('idle'), 2000)
  }

  const changeStatus = async (s: string) => {
    const previous = status
    setStatus(s as ContentPiece['status']) // affichage optimiste
    setStatusError(null)
    const ok = await onPatch({ status: s as ContentPiece['status'] })
    if (!ok) {
      // Le PATCH a échoué (RLS, réseau…) — annule l'affichage optimiste au
      // lieu de laisser l'UI montrer un statut qui n'a jamais été sauvegardé.
      setStatus(previous)
      setStatusError('Le changement de statut n’a pas pu être enregistré. Réessaie.')
    }
  }

  const updateRefs = async (newRefs: ReferenceLink[]) => {
    setRefs(newRefs)
    await onPatch({ reference_links: newRefs })
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={cn('badge text-xs', PLATFORM_COLORS[item.platform] ?? 'badge-gray')}>
            {PLATFORM_LABELS[item.platform] ?? item.platform}
          </span>
          <span className="text-xs text-gray-400">{TYPE_LABELS[item.type] ?? item.type}</span>
          {item.assigned_to && <span className="text-xs text-gray-400">· {item.assigned_to}</span>}
          <span className={cn(
            'text-xs transition-all',
            anyStatus === 'saved'  ? 'text-green-500' :
            anyStatus === 'saving' ? 'text-gray-400'  :
            anyStatus === 'error'  ? 'text-red-500'   : 'text-transparent'
          )}>
            {anyStatus === 'saving' ? 'Sauvegarde…' : anyStatus === 'error' ? 'Échec de la sauvegarde' : 'Sauvegardé ✓'}
          </span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors" title="Supprimer">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Fermer">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 sm:px-8 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
        <span className="text-xs text-gray-500 mr-1 flex-shrink-0">Statut :</span>
        {STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s]
          const active = status === s
          return (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-all border flex-shrink-0',
                active
                  ? cn(cfg.cls, 'border-current ring-2 ring-offset-1 ring-current/30')
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              )}
            >
              {cfg.label}
            </button>
          )
        })}
      </div>

      {statusError && (
        <div className="px-4 sm:px-8 py-2 bg-red-50 border-b border-red-100 text-sm text-red-600 flex-shrink-0">
          {statusError}
        </div>
      )}

      {/* Body — colonne centrée, style Notion */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-8">

          {/* Titre éditable en grand */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titre du concept"
            className="text-3xl sm:text-4xl font-bold text-gray-900 w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-auchu-400 focus:outline-none py-1 transition-colors"
          />

          {/* Date de publication + Assigné à */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <SaveLabel label="Date de publication" status={scheduleStatus} />
              <input
                type="date"
                value={scheduledAt}
                onChange={e => changeScheduledAt(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <SaveLabel label="Assigné à" status={assignStatus} />
              <select
                value={assignedTo}
                onChange={e => changeAssignedTo(e.target.value)}
                className="select text-sm"
              >
                <option value="">Personne</option>
                {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          </section>

          {/* Description */}
          <section>
            <SaveLabel label="Description" status={descStatus} />
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="Contexte, objectifs, brief…"
            />
          </section>

          {/* Script */}
          <section>
            <SaveLabel
              label={item.type === 'script_video' ? 'Script vidéo' : 'Texte / Script'}
              status={scriptStatus}
            />
            <RichTextEditor
              content={script}
              onChange={setScript}
              placeholder="Saisis le texte du post, le script de la vidéo…"
              minHeight="320px"
            />
          </section>

          {/* References */}
          <ReferencesSection links={refs} onUpdate={updateRefs} />

          {/* Client notes (readonly — filled by client via portal) */}
          {item.client_notes && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Notes du client
                <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] normal-case tracking-normal font-medium">Reçu</span>
              </h3>
              <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-line">
                {item.client_notes}
              </div>
            </section>
          )}

          {/* Approve / Refuse */}
          <section className="flex gap-3 pb-8">
            <button
              onClick={() => changeStatus('approuve')}
              disabled={status === 'approuve'}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-60',
                status === 'approuve'
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700'
              )}
            >
              <ThumbsUp className="w-4 h-4" />
              Approuver
            </button>
            <button
              onClick={() => changeStatus('refuse')}
              disabled={status === 'refuse'}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-60',
                status === 'refuse'
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
              )}
            >
              <ThumbsDown className="w-4 h-4" />
              Refuser
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

// ─── Save label ───────────────────────────────────────────────────────────────

function SaveLabel({ label, status }: { label: string; status: SaveStatus }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</h3>
      <span className={cn(
        'text-xs transition-all',
        status === 'saved'  ? 'text-green-500' :
        status === 'saving' ? 'text-gray-400'  :
        status === 'error'  ? 'text-red-500'   : 'text-transparent select-none'
      )}>
        {status === 'saving' ? 'Sauvegarde…' : status === 'error' ? 'Échec — non enregistré' : 'Sauvegardé ✓'}
      </span>
    </div>
  )
}

// ─── References section ───────────────────────────────────────────────────────

function ReferencesSection({
  links, onUpdate,
}: {
  links: ReferenceLink[]
  onUpdate: (links: ReferenceLink[]) => void
}) {
  const [adding,   setAdding]   = useState(false)
  const [newUrl,   setNewUrl]   = useState('')
  const [newTitle, setNewTitle] = useState('')

  const add = () => {
    const url = newUrl.trim()
    if (!url) return
    onUpdate([...links, { url, title: newTitle.trim(), platform: detectPlatform(url) }])
    setNewUrl('')
    setNewTitle('')
    setAdding(false)
  }

  const remove = (i: number) => onUpdate(links.filter((_, idx) => idx !== i))

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Références &amp; inspiration
          {links.length > 0 && <span className="ml-1.5 font-normal text-gray-300">({links.length})</span>}
        </h3>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-auchu-600 hover:text-auchu-700 font-medium transition-colors"
          >
            <Plus className="w-3 h-3" /> Ajouter un lien
          </button>
        )}
      </div>

      <div className="space-y-2">
        {links.map((lnk, i) => (
          <RefCard key={i} link={lnk} onRemove={() => remove(i)} />
        ))}
      </div>

      {adding && (
        <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
          <input
            type="url"
            autoFocus
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } if (e.key === 'Escape') setAdding(false) }}
            placeholder="https://www.instagram.com/p/..."
            className="input text-sm"
          />
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Titre ou note (optionnel)"
            className="input text-sm"
          />
          {newUrl && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Plateforme détectée :</span>
              <PlatformBadge platform={detectPlatform(newUrl)} />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setAdding(false); setNewUrl(''); setNewTitle('') }} className="btn-secondary text-xs py-1.5 px-3">Annuler</button>
            <button onClick={add} disabled={!newUrl.trim()} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
              <Check className="w-3 h-3" /> Ajouter
            </button>
          </div>
        </div>
      )}

      {links.length === 0 && !adding && (
        <p className="text-xs text-gray-300 italic">Aucune référence — ajoute des liens d'inspiration.</p>
      )}
    </section>
  )
}

function PlatformBadge({ platform }: { platform: string }) {
  const cfg = REF_PLATFORMS[platform] ?? REF_PLATFORMS.web
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}

function RefCard({ link, onRemove, readonly }: { link: ReferenceLink; onRemove?: () => void; readonly?: boolean }) {
  const cfg   = REF_PLATFORMS[link.platform] ?? REF_PLATFORMS.web
  const ytThumb = link.platform === 'youtube' ? getYouTubeThumbnail(link.url) : null

  return (
    <div className="group flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all">
      {ytThumb ? (
        <img src={ytThumb} alt="" className="w-16 h-10 object-cover rounded-lg flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base" style={{ background: cfg.bg }}>
          {cfg.emoji}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{link.title || link.url}</p>
        {link.title && <p className="text-[11px] text-gray-400 truncate">{link.url}</p>}
        <PlatformBadge platform={link.platform} />
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href={link.url} target="_blank" rel="noopener noreferrer"
          className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        {!readonly && onRemove && (
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="p-1.5 rounded-lg text-gray-200 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Add content modal ────────────────────────────────────────────────────────

function AddContentModal({
  clientId, selectedYear, selectedMonth, onClose, onCreated,
}: {
  clientId: string
  selectedYear: number
  selectedMonth: number
  onClose: () => void
  onCreated: (item: ContentPiece) => void
}) {
  const [form, setForm] = useState({
    title: '', type: 'video_organique', platform: 'toutes', status: 'idee',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true); setError(null)
    const res = await fetch('/api/contenus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        client_id: clientId,
        // Aucune date précisée à la création — l'idée est toujours rattachée
        // explicitement au mois de l'onglet actif (celui affiché à l'écran),
        // pas au mois courant du calendrier.
        month_target: monthStartISO(selectedYear, selectedMonth),
      }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      console.error('[ProjetsTab] POST /api/contenus échoué —', 'status:', res.status, '| error:', json)
      setError(json?.error ?? `Erreur ${res.status} — le contenu n'a pas pu être créé.`)
      setSaving(false)
      return
    }
    onCreated(json.data)
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-semibold text-gray-900">Nouveau contenu</h3>
          <button onClick={onClose} className="p-2 -m-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="label">Titre *</label>
            <input type="text" required autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input text-sm" placeholder="Titre du contenu" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="select text-sm">
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Plateforme</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="select text-sm">
                {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="select text-sm">
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Rattaché à {MONTHS_FR[selectedMonth]} {selectedYear}. La date de publication et la personne assignée se règlent après création, dans la fiche du concept.
          </p>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer le contenu'}
            </button>
          </div>
        </form>
      </div>
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {isTournage
              ? <Video className="w-4 h-4 text-blue-500" />
              : <Send className="w-4 h-4" style={{ color: '#f95640' }} />
            }
            <h3 className="font-semibold text-gray-900">
              {isTournage ? 'Ajouter un tournage' : 'Ajouter une publication'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 -m-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
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
                  {CALENDAR_PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
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
              className="flex-1 flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: accentColor }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
