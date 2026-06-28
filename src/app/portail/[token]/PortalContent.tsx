'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ThumbsUp, ThumbsDown, Loader2, MessageSquare, ChevronRight, ExternalLink, Link2 } from 'lucide-react'
import { ContentPiece, CalendarEvent, ReferenceLink } from '@/types'
import { cn, formatDate } from '@/lib/utils'

// ─── Reference helpers ────────────────────────────────────────────────────────

const REF_PLATFORMS: Record<string, { label: string; bg: string; color: string; emoji: string }> = {
  instagram: { label: 'Instagram', bg: '#fce7f3', color: '#be185d', emoji: '📸' },
  tiktok:    { label: 'TikTok',    bg: '#f1f5f9', color: '#0f172a', emoji: '🎵' },
  youtube:   { label: 'YouTube',   bg: '#fee2e2', color: '#dc2626', emoji: '▶' },
  facebook:  { label: 'Facebook',  bg: '#dbeafe', color: '#1d4ed8', emoji: '👥' },
  linkedin:  { label: 'LinkedIn',  bg: '#e0f2fe', color: '#0284c7', emoji: '💼' },
  x:         { label: 'X / Twitter', bg: '#f1f5f9', color: '#0f172a', emoji: '𝕏' },
  web:       { label: 'Lien web',  bg: '#f3f4f6', color: '#374151', emoji: '🔗' },
}

function getYouTubeThumbnail(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null
}

function RefCard({ link }: { link: ReferenceLink }) {
  const cfg    = REF_PLATFORMS[link.platform] ?? REF_PLATFORMS.web
  const ytThumb = link.platform === 'youtube' ? getYouTubeThumbnail(link.url) : null
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-white">
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium mt-0.5" style={{ background: cfg.bg, color: cfg.color }}>
          {cfg.emoji} {cfg.label}
        </span>
      </div>
      <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0">
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  )
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  post: 'Post', reel: 'Reel', story: 'Story', script_video: 'Script vidéo', ad: 'Ad',
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  linkedin: 'LinkedIn', google: 'Google Ads', meta: 'Meta Ads',
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook:  'bg-blue-100 text-blue-700',
  tiktok:    'bg-slate-100 text-slate-700',
  linkedin:  'bg-sky-100 text-sky-700',
  google:    'bg-amber-100 text-amber-700',
  meta:      'bg-indigo-100 text-indigo-700',
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  idee:         { label: 'Idée',         cls: 'bg-gray-100  text-gray-600'   },
  en_redaction: { label: 'En rédaction', cls: 'bg-blue-100  text-blue-700'   },
  pret:         { label: 'Prêt',         cls: 'bg-amber-100 text-amber-700'  },
  approuve:     { label: 'Approuvé ✓',   cls: 'bg-green-100 text-green-700'  },
  refuse:       { label: 'Refusé',       cls: 'bg-red-100   text-red-700'    },
  draft:        { label: 'Brouillon',    cls: 'bg-gray-100  text-gray-600'   },
  review:       { label: 'À approuver',  cls: 'bg-amber-100 text-amber-700'  },
  publie:       { label: 'Publié',       cls: 'bg-green-100 text-green-700'  },
}

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  content:  ContentPiece[]
  events:   CalendarEvent[]
  token:    string
  primary:  string
  secondary: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalContent({ content: initial, events, token, primary, secondary }: Props) {
  const [items, setItems]       = useState<ContentPiece[]>(initial)
  const [selected, setSelected] = useState<ContentPiece | null>(null)
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [mounted, setMounted]   = useState(false)

  const gradient = `linear-gradient(135deg, ${primary}, ${secondary})`

  // ─── Polling — re-fetch content every 10 s ────────────────────────────────
  const fetchContent = useCallback(async () => {
    const res = await fetch(`/api/portail/${token}/contenu`)
    if (res.ok) {
      const { data } = await res.json()
      setItems(data ?? [])
      setLastSync(new Date())  // safe — only called client-side via useEffect
    }
  }, [token])

  useEffect(() => {
    setMounted(true)
    fetchContent()
    const interval = setInterval(fetchContent, 10_000)
    return () => clearInterval(interval)
  }, [fetchContent])

  const openItem = (item: ContentPiece) => {
    setSelected(item)
    setNotes(item.client_notes ?? '')
  }

  const portalPatch = async (id: string, fields: Record<string, unknown>) => {
    setSaving(id)
    const res = await fetch(`/api/portail/${token}/contenu/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (res.ok) {
      const { data } = await res.json()
      setItems(prev => prev.map(i => i.id === id ? data : i))
      if (selected?.id === id) setSelected(data)
    }
    setSaving(null)
  }

  const saveNotes = () => portalPatch(selected!.id, { client_notes: notes })

  // ─── Calendar grids ──────────────────────────────────────────────────────────

  const [calType, setCalType] = useState<'tournage' | 'publication'>('tournage')
  const [calDate, setCalDate] = useState(new Date())

  const year  = calDate.getFullYear()
  const month = calDate.getMonth()

  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthEvents = events.filter(e => {
    if (e.type !== calType) return false
    const d = new Date(e.date)
    return d.getFullYear() === year && d.getMonth() === month
  })

  const monthContent = calType === 'publication'
    ? items.filter(c => {
        if (!c.scheduled_at) return false
        const d = new Date(c.scheduled_at)
        return d.getFullYear() === year && d.getMonth() === month
      })
    : []

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

  const today      = new Date()
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month

  // Contenus à approuver
  const toReview = items.filter(c => c.status === 'review' || c.status === 'pret')

  return (
    <div className="space-y-10">

      {/* ── Contenus à approuver ────────────────────────────────────────────── */}
      {toReview.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: gradient }}>
              <ThumbsUp className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900">
              Contenus à approuver
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                {toReview.length}
              </span>
            </h2>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3 text-sm text-amber-800">
            Ces contenus sont prêts pour votre approbation. Cliquez pour voir le détail et laisser vos commentaires.
          </div>
          <div className="space-y-2">
            {toReview.map(c => (
              <button
                key={c.id}
                onClick={() => openItem(c)}
                className="w-full bg-white rounded-xl border border-amber-200 px-4 py-3 flex items-center justify-between hover:shadow-sm transition-shadow text-left"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{c.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', PLATFORM_COLORS[c.platform] ?? 'bg-gray-100 text-gray-600')}>
                      {PLATFORM_LABELS[c.platform] ?? c.platform}
                    </span>
                    <span className="text-xs text-gray-400">{TYPE_LABELS[c.type] ?? c.type}</span>
                    {c.client_notes && <MessageSquare className="w-3 h-3 text-amber-400" />}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Tous les contenus ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: gradient }}>
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900">Tous les contenus</h2>
          </div>
          <div className="flex items-center gap-2">
            {mounted && lastSync && (
              <span className="text-xs text-gray-400">
                Mis à jour {lastSync.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchContent}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
            >
              ↻ Rafraîchir
            </button>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucun contenu pour l'instant.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Titre</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Plateforme</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {items.map(c => {
                  const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.idee
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => openItem(c)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-1.5">
                          {c.title}
                          {c.client_notes && <MessageSquare className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{TYPE_LABELS[c.type] ?? c.type}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', PLATFORM_COLORS[c.platform] ?? 'bg-gray-100 text-gray-600')}>
                          {PLATFORM_LABELS[c.platform] ?? c.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', sc.cls)}>
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Calendrier ──────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Calendrier</h2>
          <div className="flex items-center gap-2">
            {/* Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 text-xs">
              <button
                onClick={() => setCalType('tournage')}
                className={cn('px-2.5 py-1.5 rounded-md font-medium transition-all', calType === 'tournage' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500')}
              >Tournage</button>
              <button
                onClick={() => setCalType('publication')}
                className={cn('px-2.5 py-1.5 rounded-md font-medium transition-all', calType === 'publication' ? 'bg-white shadow-sm' : 'text-gray-500')}
                style={calType === 'publication' ? { color: '#f95640' } : undefined}
              >Publication</button>
            </div>
            <button onClick={() => setCalDate(new Date(year, month - 1, 1))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">←</button>
            <span className="text-sm font-medium text-gray-700">{MONTHS_FR[month]} {year}</span>
            <button onClick={() => setCalDate(new Date(year, month + 1, 1))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">→</button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS_FR.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="min-h-[80px] bg-gray-50/40" />
              const dayEvs  = eventsByDay[day]  ?? []
              const dayCont = contentByDay[day] ?? []
              const isTd    = isThisMonth && day === today.getDate()

              return (
                <div key={i} className={cn('min-h-[80px] p-1.5', isTd && 'bg-indigo-50/30')}>
                  <span
                    className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full"
                    style={isTd ? { background: primary, color: 'white' } : { color: '#6b7280' }}
                  >{day}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvs.map(ev => (
                      <div
                        key={ev.id}
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium truncate"
                        style={calType === 'tournage'
                          ? { background: '#dbeafe', color: '#1e40af' }
                          : { background: '#fff1f0', color: '#f95640' }}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayCont.map(c => (
                      <div
                        key={c.id}
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium truncate bg-pink-100 text-pink-700"
                        title={c.title}
                      >
                        {c.title}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Content side panel ──────────────────────────────────────────────── */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40" onClick={() => setSelected(null)} />
          <aside className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-100 flex-shrink-0" style={{ background: `linear-gradient(135deg, ${primary}10, ${secondary}10)` }}>
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', PLATFORM_COLORS[selected.platform] ?? 'bg-gray-100 text-gray-600')}>
                    {PLATFORM_LABELS[selected.platform] ?? selected.platform}
                  </span>
                  <span className="text-xs text-gray-400">{TYPE_LABELS[selected.type] ?? selected.type}</span>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{selected.title}</h2>
                {(() => { const sc = STATUS_CONFIG[selected.status]; return sc ? (
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1', sc.cls)}>{sc.label}</span>
                ) : null })()}
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-white/80 transition-colors flex-shrink-0">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {selected.description && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{selected.description}</p>
                </section>
              )}

              {(selected.script || selected.body) && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {selected.type === 'script_video' ? 'Script vidéo' : 'Texte / Script'}
                  </h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {selected.script ?? selected.body}
                  </div>
                </section>
              )}

              {/* Reference links */}
              {(selected.reference_links ?? []).length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    Références &amp; inspiration
                    <span className="font-normal text-gray-300">({selected.reference_links.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {(selected.reference_links ?? []).map((lnk, i) => (
                      <RefCard key={i} link={lnk} />
                    ))}
                  </div>
                </section>
              )}

              {/* Client notes */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Mes notes / commentaires</h3>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Laissez vos commentaires, demandes de modification…"
                  rows={5}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent placeholder:text-gray-300 resize-none"
                  style={{ '--tw-ring-color': primary } as React.CSSProperties}
                />
                {notes !== (selected.client_notes ?? '') && (
                  <button
                    onClick={saveNotes}
                    disabled={saving === selected.id}
                    className="mt-2 text-sm font-medium px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: primary }}
                  >
                    {saving === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer mes notes'}
                  </button>
                )}
              </section>

              {/* Approve / Refuse */}
              <section className="flex gap-3">
                <button
                  onClick={() => portalPatch(selected.id, { status: 'approuve' })}
                  disabled={!!saving || selected.status === 'approuve'}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-50',
                    selected.status === 'approuve'
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700'
                  )}
                >
                  <ThumbsUp className="w-4 h-4" />
                  Approuver
                </button>
                <button
                  onClick={() => portalPatch(selected.id, { status: 'refuse' })}
                  disabled={!!saving || selected.status === 'refuse'}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-50',
                    selected.status === 'refuse'
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
                  )}
                >
                  <ThumbsDown className="w-4 h-4" />
                  Refuser
                </button>
              </section>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
