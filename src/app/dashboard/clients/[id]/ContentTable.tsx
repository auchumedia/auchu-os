'use client'

import { useState } from 'react'
import { Plus, X, ChevronRight, Loader2, Check, ThumbsUp, ThumbsDown, MessageSquare, Trash2 } from 'lucide-react'
import { ContentPiece } from '@/types'
import { cn, formatDate } from '@/lib/utils'

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  post: 'Post', reel: 'Reel', story: 'Story', script_video: 'Script vidéo', ad: 'Ad',
  caption: 'Caption', script: 'Script', email: 'Email',
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
  idee:        { label: 'Idée',          cls: 'bg-gray-100   text-gray-600'   },
  en_redaction:{ label: 'En rédaction',  cls: 'bg-blue-100   text-blue-700'   },
  pret:        { label: 'Prêt',          cls: 'bg-amber-100  text-amber-700'  },
  approuve:    { label: 'Approuvé',      cls: 'bg-green-100  text-green-700'  },
  refuse:      { label: 'Refusé',        cls: 'bg-red-100    text-red-700'    },
  draft:       { label: 'Brouillon',     cls: 'bg-gray-100   text-gray-600'   },
  review:      { label: 'En révision',   cls: 'bg-purple-100 text-purple-700' },
  publie:      { label: 'Publié',        cls: 'bg-green-100  text-green-700'  },
}

const TYPES   = ['post','reel','story','script_video','ad']
const PLATFORMS = ['instagram','facebook','tiktok','linkedin','google','meta']
const STATUSES = ['idee','en_redaction','pret','approuve','refuse']

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialContent: ContentPiece[]
  clientId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContentTable({ initialContent, clientId }: Props) {
  const [items, setItems]       = useState<ContentPiece[]>(initialContent)
  const [selected, setSelected] = useState<ContentPiece | null>(null)
  const [showAdd, setShowAdd]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [panelNotes, setPanelNotes] = useState('')

  // ─── Panel open / close ────────────────────────────────────────────────────

  const openItem = (item: ContentPiece) => {
    setSelected(item)
    setPanelNotes(item.client_notes ?? '')
  }

  const closePanel = () => setSelected(null)

  // ─── PATCH helper ──────────────────────────────────────────────────────────

  const patchItem = async (id: string, fields: Partial<ContentPiece>) => {
    setSaving(true)
    const res = await fetch(`/api/contenus/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (res.ok) {
      const { data } = await res.json()
      setItems(prev => prev.map(i => i.id === id ? data : i))
      if (selected?.id === id) setSelected(data)
    }
    setSaving(false)
    return res.ok
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  const deleteItem = async (id: string) => {
    if (!confirm('Supprimer ce contenu ?')) return
    await fetch(`/api/contenus/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    if (selected?.id === id) closePanel()
  }

  // ─── Render ────────────────────────────────────────────────────────────────

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
                        {item.client_notes && (
                          <span title="Notes client"><MessageSquare className="w-3 h-3 text-amber-400 flex-shrink-0" /></span>
                        )}
                      </div>
                    </td>
                    <td className="text-xs text-gray-500">{TYPE_LABELS[item.type] ?? item.type}</td>
                    <td>
                      <span className={cn('badge text-xs', PLATFORM_COLORS[item.platform] ?? 'badge-gray')}>
                        {PLATFORM_LABELS[item.platform] ?? item.platform}
                      </span>
                    </td>
                    <td>
                      <span className={cn('badge text-xs', sc.cls)}>{sc.label}</span>
                    </td>
                    <td className="text-xs text-gray-500">{item.assigned_to ?? '—'}</td>
                    <td className="text-xs text-gray-400">
                      {item.scheduled_at ? formatDate(item.scheduled_at) : '—'}
                    </td>
                    <td>
                      <button
                        onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Side panel ────────────────────────────────────────────────────────── */}
      {selected && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            onClick={closePanel}
          />
          <aside className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-100 flex-shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={cn('badge text-xs', PLATFORM_COLORS[selected.platform] ?? 'badge-gray')}>
                    {PLATFORM_LABELS[selected.platform] ?? selected.platform}
                  </span>
                  <span className="text-xs text-gray-400">{TYPE_LABELS[selected.type] ?? selected.type}</span>
                  {selected.assigned_to && (
                    <span className="text-xs text-gray-400">· {selected.assigned_to}</span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{selected.title}</h2>
              </div>
              <button onClick={closePanel} className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Panel status bar */}
            <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
              <span className="text-xs text-gray-500 mr-1">Statut :</span>
              {STATUSES.map(s => {
                const sc = STATUS_CONFIG[s]
                const active = selected.status === s
                return (
                  <button
                    key={s}
                    onClick={() => patchItem(selected.id, { status: s as ContentPiece['status'] })}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                      active
                        ? cn(sc.cls, 'border-current ring-2 ring-offset-1 ring-current/30')
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    )}
                  >
                    {sc.label}
                  </button>
                )
              })}
              {saving && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin ml-1" />}
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Description */}
              {selected.description && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{selected.description}</p>
                </section>
              )}

              {/* Script / Texte */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {selected.type === 'script_video' ? 'Script vidéo' : 'Texte / Script'}
                </h3>
                <ContentScriptEditor
                  value={selected.script ?? ''}
                  onSave={val => patchItem(selected.id, { script: val })}
                  saving={saving}
                />
              </section>

              {/* Notes client */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Notes du client
                  {selected.client_notes && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 normal-case tracking-normal font-medium">
                      Note reçue
                    </span>
                  )}
                </h3>
                <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3">
                  <textarea
                    value={panelNotes}
                    onChange={e => setPanelNotes(e.target.value)}
                    placeholder="Notes ou retours laissés par le client via le portail…"
                    rows={4}
                    className="w-full bg-transparent text-sm text-gray-700 resize-none focus:outline-none placeholder:text-amber-300"
                    readOnly
                  />
                </div>
              </section>

              {/* Actions approve/refuse */}
              <section className="flex gap-3">
                <button
                  onClick={() => patchItem(selected.id, { status: 'approuve' })}
                  disabled={saving || selected.status === 'approuve'}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-50',
                    selected.status === 'approuve'
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50 hover:text-green-700'
                  )}
                >
                  <ThumbsUp className="w-4 h-4" />
                  Approuver
                </button>
                <button
                  onClick={() => patchItem(selected.id, { status: 'refuse' })}
                  disabled={saving || selected.status === 'refuse'}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-50',
                    selected.status === 'refuse'
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
                  )}
                >
                  <ThumbsDown className="w-4 h-4" />
                  Refuser
                </button>
              </section>

              {selected.scheduled_at && (
                <p className="text-xs text-gray-400">
                  Planifié le {formatDate(selected.scheduled_at)}
                </p>
              )}
            </div>
          </aside>
        </>
      )}

      {/* ── Add modal ─────────────────────────────────────────────────────────── */}
      {showAdd && (
        <AddContentModal
          clientId={clientId}
          onClose={() => setShowAdd(false)}
          onCreated={item => {
            setItems(prev => [item, ...prev])
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Script editor (inline save) ──────────────────────────────────────────────

function ContentScriptEditor({
  value, onSave, saving,
}: {
  value: string
  onSave: (v: string) => void
  saving: boolean
}) {
  const [draft, setDraft]   = useState(value)
  const [edited, setEdited] = useState(false)

  return (
    <div>
      <textarea
        value={draft}
        onChange={e => { setDraft(e.target.value); setEdited(true) }}
        placeholder="Saisis le texte du post, le script de la vidéo…"
        rows={10}
        className="input text-sm resize-none w-full font-mono text-gray-800"
      />
      {edited && (
        <button
          onClick={() => { onSave(draft); setEdited(false) }}
          disabled={saving}
          className="mt-2 flex items-center gap-1.5 text-xs text-auchu-600 hover:text-auchu-700 font-medium"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Sauvegarder le script
        </button>
      )}
    </div>
  )
}

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
    setSaving(true)
    setError(null)
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
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-x-0 top-1/2 -translate-y-1/2 mx-auto max-w-xl w-full bg-white rounded-2xl shadow-2xl z-50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Nouveau contenu</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="label">Titre *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input text-sm"
              placeholder="Titre du contenu"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <input
                type="text"
                value={form.assigned_to}
                onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                className="input text-sm"
                placeholder="Nom du responsable"
              />
            </div>
          </div>
          <div>
            <label className="label">Date de publication prévue</label>
            <input
              type="date"
              value={form.scheduled_at}
              onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="input text-sm resize-none"
              placeholder="Contexte, objectifs…"
            />
          </div>
          <div>
            <label className="label">Script / Texte</label>
            <textarea
              rows={4}
              value={form.script}
              onChange={e => setForm(f => ({ ...f, script: e.target.value }))}
              className="input text-sm resize-none font-mono"
              placeholder="Texte du post ou script complet…"
            />
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
    </>
  )
}
