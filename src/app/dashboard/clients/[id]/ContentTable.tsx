'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, X, ChevronRight, Loader2, ThumbsUp, ThumbsDown, Trash2, ExternalLink, Link2, Check } from 'lucide-react'
import { ContentPiece, ReferenceLink } from '@/types'
import { cn, formatDate } from '@/lib/utils'

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  post: 'Post', reel: 'Reel', story: 'Story', script_video: 'Script vidéo', ad: 'Ad',
  caption: 'Caption', script: 'Script', email: 'Email',
}
const TYPES = ['post','reel','story','script_video','ad']

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  linkedin: 'LinkedIn', google: 'Google Ads', meta: 'Meta Ads',
}
const PLATFORMS = ['instagram','facebook','tiktok','linkedin','google','meta']

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook:  'bg-blue-100 text-blue-700',
  tiktok:    'bg-slate-100 text-slate-700',
  linkedin:  'bg-sky-100 text-sky-700',
  google:    'bg-amber-100 text-amber-700',
  meta:      'bg-indigo-100 text-indigo-700',
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  idee:         { label: 'Idée',         cls: 'bg-gray-100   text-gray-600'   },
  en_redaction: { label: 'En rédaction', cls: 'bg-blue-100   text-blue-700'   },
  pret:         { label: 'Prêt',         cls: 'bg-amber-100  text-amber-700'  },
  approuve:     { label: 'Approuvé',     cls: 'bg-green-100  text-green-700'  },
  refuse:       { label: 'Refusé',       cls: 'bg-red-100    text-red-700'    },
  draft:        { label: 'Brouillon',    cls: 'bg-gray-100   text-gray-600'   },
  review:       { label: 'En révision',  cls: 'bg-purple-100 text-purple-700' },
  publie:       { label: 'Publié',       cls: 'bg-green-100  text-green-700'  },
}
const STATUSES = ['idee','en_redaction','pret','approuve','refuse']

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

// ─── Auto-save hook ───────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved'

function useAutoSave(
  value: string,
  onSave: (v: string) => Promise<void>,
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
      await onSave(value)
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
  clientId: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ContentTable({ initialContent, clientId }: Props) {
  const [items, setItems]       = useState<ContentPiece[]>(initialContent)
  const [selected, setSelected] = useState<ContentPiece | null>(null)
  const [showAdd, setShowAdd]   = useState(false)

  const openItem  = (item: ContentPiece) => setSelected(item)
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
    }
    return res.ok
  }, [])

  const deleteItem = async (id: string) => {
    if (!confirm('Supprimer ce contenu ?')) return
    await fetch(`/api/contenus/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    if (selected?.id === id) closePanel()
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{items.length} contenu{items.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Ajouter un contenu
        </button>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-sm">Aucun contenu — crée le premier</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Type</th>
                  <th>Plateforme</th>
                  <th>Statut</th>
                  <th>Assigné à</th>
                  <th>Planifié</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.idee
                  return (
                    <tr
                      key={item.id}
                      className="cursor-pointer hover:bg-gray-50/80 transition-colors"
                      onClick={() => openItem(item)}
                    >
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
                      <td className="text-xs text-gray-400">{item.scheduled_at ? formatDate(item.scheduled_at) : '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Side panel */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40" onClick={closePanel} />
          <aside className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            <ContentPanel
              key={selected.id}
              item={selected}
              onPatch={(fields) => patchItem(selected.id, fields)}
              onClose={closePanel}
              onDelete={() => deleteItem(selected.id)}
            />
          </aside>
        </>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddContentModal
          clientId={clientId}
          onClose={() => setShowAdd(false)}
          onCreated={item => { setItems(prev => [item, ...prev]); setShowAdd(false) }}
        />
      )}
    </div>
  )
}

// ─── Content panel ────────────────────────────────────────────────────────────

function ContentPanel({
  item, onPatch, onClose, onDelete,
}: {
  item: ContentPiece
  onPatch: (fields: Partial<ContentPiece>) => Promise<boolean>
  onClose: () => void
  onDelete: () => void
}) {
  const [title,       setTitle]       = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [script,      setScript]      = useState(item.script ?? '')
  const [status,      setStatus]      = useState(item.status)
  const [refs,        setRefs]        = useState<ReferenceLink[]>(item.reference_links ?? [])

  const titleStatus = useAutoSave(title,       v => onPatch({ title: v }).then(() => {}))
  const descStatus  = useAutoSave(description, v => onPatch({ description: v || null }).then(() => {}))
  const scriptStatus = useAutoSave(script,     v => onPatch({ script: v || null, body: v || '' }).then(() => {}))

  // Any field saving indicator
  const anyStatus = [titleStatus, descStatus, scriptStatus].find(s => s !== 'idle') ?? 'idle'

  const changeStatus = async (s: string) => {
    setStatus(s as ContentPiece['status'])
    await onPatch({ status: s as ContentPiece['status'] })
  }

  const updateRefs = async (newRefs: ReferenceLink[]) => {
    setRefs(newRefs)
    await onPatch({ reference_links: newRefs })
  }

  const sc = STATUS_CONFIG[item.platform] // unused, just to keep ref

  return (
    <>
      {/* Panel header */}
      <div className="flex items-start justify-between p-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn('badge text-xs', PLATFORM_COLORS[item.platform] ?? 'badge-gray')}>
              {PLATFORM_LABELS[item.platform] ?? item.platform}
            </span>
            <span className="text-xs text-gray-400">{TYPE_LABELS[item.type] ?? item.type}</span>
            {item.assigned_to && <span className="text-xs text-gray-400">· {item.assigned_to}</span>}
            {/* Global save indicator */}
            <span className={cn(
              'text-xs transition-all ml-auto',
              anyStatus === 'saved'  ? 'text-green-500' :
              anyStatus === 'saving' ? 'text-gray-400'  : 'text-transparent'
            )}>
              {anyStatus === 'saving' ? 'Sauvegarde…' : 'Sauvegardé ✓'}
            </span>
          </div>
          {/* Editable title */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-lg font-semibold text-gray-900 w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-auchu-400 focus:outline-none py-0.5 transition-colors"
          />
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors" title="Supprimer">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">

        {/* Description */}
        <section>
          <SaveLabel label="Description" status={descStatus} />
          <AutoSaveTextarea
            value={description}
            onChange={setDescription}
            placeholder="Contexte, objectifs, brief…"
            rows={3}
          />
        </section>

        {/* Script */}
        <section>
          <SaveLabel
            label={item.type === 'script_video' ? 'Script vidéo' : 'Texte / Script'}
            status={scriptStatus}
          />
          <AutoSaveTextarea
            value={script}
            onChange={setScript}
            placeholder="Saisis le texte du post, le script de la vidéo…"
            rows={10}
            mono
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
        <section className="flex gap-3 pb-2">
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
    </>
  )
}

// ─── Auto-save textarea ───────────────────────────────────────────────────────

function SaveLabel({ label, status }: { label: string; status: SaveStatus }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</h3>
      <span className={cn(
        'text-xs transition-all',
        status === 'saved'  ? 'text-green-500' :
        status === 'saving' ? 'text-gray-400'  : 'text-transparent select-none'
      )}>
        {status === 'saving' ? 'Sauvegarde…' : 'Sauvegardé ✓'}
      </span>
    </div>
  )
}

function AutoSaveTextarea({
  value, onChange, placeholder, rows, mono,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  mono?: boolean
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows ?? 4}
      className={cn('input text-sm resize-none w-full', mono && 'font-mono text-gray-800 leading-relaxed')}
    />
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

// Export RefCard + ReferencesSection for reuse in portal
export { RefCard, ReferencesSection }

// ─── Add content modal ────────────────────────────────────────────────────────

function AddContentModal({
  clientId, onClose, onCreated,
}: {
  clientId: string
  onClose: () => void
  onCreated: (item: ContentPiece) => void
}) {
  const [form, setForm] = useState({
    title: '', type: 'post', platform: 'instagram',
    status: 'idee', assigned_to: '', description: '', script: '',
    scheduled_at: '',
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
        client_id:    clientId,
        assigned_to:  form.assigned_to  || null,
        description:  form.description  || null,
        script:       form.script       || null,
        scheduled_at: form.scheduled_at || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Erreur'); setSaving(false); return }
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
            <div>
              <label className="label">Assigné à</label>
              <input type="text" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="input text-sm" placeholder="Nom du responsable" />
            </div>
          </div>
          <div>
            <label className="label">Date de publication prévue</label>
            <input type="date" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className="input text-sm" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input text-sm resize-none" placeholder="Contexte, objectifs…" />
          </div>
          <div>
            <label className="label">Script / Texte</label>
            <textarea rows={4} value={form.script} onChange={e => setForm(f => ({ ...f, script: e.target.value }))} className="input text-sm resize-none font-mono" placeholder="Texte du post ou script complet…" />
          </div>
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
