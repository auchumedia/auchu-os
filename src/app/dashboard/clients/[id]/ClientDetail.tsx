'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Camera, ExternalLink, Copy, Check, Plus, Loader2,
  Calendar, FileText, FolderKanban, CreditCard, Globe, Pencil,
  Save, X, Trash2, CheckCircle, Send, AlertCircle,
} from 'lucide-react'
import { Client, Project, Invoice, ContentPiece } from '@/types'
import {
  cn, formatCurrency, formatDate, getInitials,
  PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
} from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'projects' | 'content' | 'invoices' | 'portal'

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'google', 'meta']

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  linkedin: 'LinkedIn', google: 'Google Ads', meta: 'Meta Ads',
}

const STATUS_CONFIG = {
  draft:     { label: 'Brouillon', cls: 'badge-gray'  },
  envoye:    { label: 'Envoyé',    cls: 'badge-blue'  },
  paye:      { label: 'Payé',      cls: 'badge-green' },
  en_retard: { label: 'En retard', cls: 'badge-red'   },
  annule:    { label: 'Annulé',    cls: 'badge-gray'  },
}

const CONTENT_PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100   text-pink-700',
  facebook:  'bg-blue-100   text-blue-700',
  tiktok:    'bg-slate-100  text-slate-700',
  linkedin:  'bg-sky-100    text-sky-700',
  google:    'bg-amber-100  text-amber-700',
  meta:      'bg-indigo-100 text-indigo-700',
}

const CONTENT_STATUS_COLORS: Record<string, string> = {
  draft:    'bg-gray-100   text-gray-600',
  review:   'bg-amber-100  text-amber-700',
  approuve: 'bg-blue-100   text-blue-700',
  publie:   'bg-green-100  text-green-700',
  refuse:   'bg-red-100    text-red-700',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  client:   Client
  projects: Project[]
  invoices: Invoice[]
  content:  ContentPiece[]
  appUrl:   string
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientDetail({ client: initial, projects, invoices, content, appUrl }: Props) {
  const router = useRouter()
  const [tab, setTab]       = useState<Tab>('overview')
  const [client, setClient] = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Logo upload
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Portal
  const [generatingPortal, setGeneratingPortal] = useState(false)
  const [portalUrl, setPortalUrl] = useState<string | null>(
    client.portal_token ? `${appUrl}/portail/${client.portal_token}` : null
  )

  // Notes editing
  const [notesValue, setNotesValue] = useState(client.internal_notes ?? '')
  const notesTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Overview editing
  const [editing, setEditing]   = useState(false)
  const [editForm, setEditForm] = useState({
    name:           client.name,
    email:          client.email ?? '',
    phone:          client.phone ?? '',
    company:        client.company ?? '',
    industry:       client.industry ?? '',
    monthly_budget: client.monthly_budget?.toString() ?? '',
    brand_tone:     client.brand_tone ?? '',
    brand_notes:    client.brand_notes ?? '',
    status:         client.status,
    platforms:      client.platforms,
  })

  // ─── Patch helper ──────────────────────────────────────────────────────────

  const patch = useCallback(async (fields: Partial<Client>) => {
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (res.ok) {
      const { data } = await res.json()
      setClient(data)
      return data
    }
  }, [client.id])

  // ─── Debounced color save ──────────────────────────────────────────────────

  const saveColor = (field: 'brand_primary' | 'brand_secondary', value: string) => {
    setClient(c => ({ ...c, [field]: value }))
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => patch({ [field]: value }), 600)
  }

  // ─── Debounced notes save ──────────────────────────────────────────────────

  const handleNotesChange = (value: string) => {
    setNotesValue(value)
    if (notesTimeout.current) clearTimeout(notesTimeout.current)
    notesTimeout.current = setTimeout(async () => {
      setSaving('notes')
      await patch({ internal_notes: value })
      setSaving(null)
    }, 800)
  }

  // ─── Logo upload ───────────────────────────────────────────────────────────

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)

    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch(`/api/clients/${client.id}/logo`, { method: 'POST', body: fd })
    if (res.ok) {
      const { logo_url } = await res.json()
      setClient(c => ({ ...c, logo_url }))
    }
    setUploadingLogo(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Overview save ─────────────────────────────────────────────────────────

  const saveOverview = async () => {
    setSaving('overview')
    await patch({
      name:           editForm.name,
      email:          editForm.email || null,
      phone:          editForm.phone || null,
      company:        editForm.company || null,
      industry:       editForm.industry || null,
      monthly_budget: editForm.monthly_budget ? Number(editForm.monthly_budget) : null,
      brand_tone:     editForm.brand_tone || null,
      brand_notes:    editForm.brand_notes || null,
      status:         editForm.status,
      platforms:      editForm.platforms,
    })
    setSaving(null)
    setEditing(false)
  }

  // ─── Portal ────────────────────────────────────────────────────────────────

  const generatePortal = async () => {
    setGeneratingPortal(true)
    const res = await fetch(`/api/clients/${client.id}/portal`, { method: 'POST' })
    if (res.ok) {
      const { portal_url, token } = await res.json()
      setPortalUrl(portal_url)
      setClient(c => ({ ...c, portal_token: token, portal_enabled: true }))
    }
    setGeneratingPortal(false)
  }

  const revokePortal = async () => {
    await fetch(`/api/clients/${client.id}/portal`, { method: 'DELETE' })
    setPortalUrl(null)
    setClient(c => ({ ...c, portal_token: null, portal_enabled: false }))
  }

  const copyPortalUrl = async () => {
    if (!portalUrl) return
    await navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const headerBg = `linear-gradient(135deg, ${client.brand_primary}18 0%, ${client.brand_secondary}18 100%)`
  const accentBg = `linear-gradient(135deg, ${client.brand_primary}, ${client.brand_secondary})`

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Vue d\'ensemble', icon: FileText },
    { id: 'projects',  label: `Projets (${projects.length})`, icon: FolderKanban },
    { id: 'content',   label: `Contenu (${content.length})`,  icon: Calendar },
    { id: 'invoices',  label: `Factures (${invoices.length})`, icon: CreditCard },
    { id: 'portal',    label: 'Portail',          icon: Globe },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border border-gray-200 overflow-hidden mb-6"
        style={{ background: headerBg }}
      >
        <div className="px-6 py-5">
          <div className="flex items-start gap-5">
            {/* Logo / Avatar */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="group relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-md flex items-center justify-center transition-all hover:shadow-lg"
                style={{ background: accentBg }}
              >
                {uploadingLogo ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : client.logo_url ? (
                  <>
                    <img
                      src={client.logo_url}
                      alt={client.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-white font-bold text-xl">{getInitials(client.name)}</span>
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
                <span className={cn('badge', {
                  actif:    'badge-green',
                  inactif:  'badge-gray',
                  prospect: 'badge-blue',
                }[client.status])}>
                  {client.status === 'actif' ? 'Actif' : client.status === 'prospect' ? 'Prospect' : 'Inactif'}
                </span>
              </div>
              {client.company && <p className="text-sm text-gray-500 mt-0.5">{client.company}</p>}

              {/* Platforms */}
              {client.platforms?.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {client.platforms.map(p => (
                    <span key={p} className="badge badge-gray text-xs">{PLATFORM_LABELS[p] ?? p}</span>
                  ))}
                </div>
              )}

              {/* Budget */}
              {client.monthly_budget && (
                <p className="text-sm text-gray-500 mt-1.5">
                  Budget mensuel : <span className="font-semibold text-gray-700">{formatCurrency(client.monthly_budget)}</span>
                </p>
              )}
            </div>

            {/* Right controls */}
            <div className="flex flex-col items-end gap-3 flex-shrink-0">
              {/* Color pickers */}
              <div className="flex items-center gap-3">
                <ColorPicker
                  label="Couleur principale"
                  value={client.brand_primary}
                  onChange={v => saveColor('brand_primary', v)}
                />
                <ColorPicker
                  label="Couleur secondaire"
                  value={client.brand_secondary}
                  onChange={v => saveColor('brand_secondary', v)}
                />
              </div>

              {/* Portal button */}
              {portalUrl ? (
                <button
                  onClick={() => window.open(portalUrl, '_blank')}
                  className="btn-secondary text-sm gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Portail client
                </button>
              ) : (
                <button
                  onClick={generatePortal}
                  disabled={generatingPortal}
                  className="btn-primary text-sm gap-1.5 disabled:opacity-50"
                  style={{ background: accentBg, border: 'none' }}
                >
                  {generatingPortal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  Créer portail client
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="px-6 pb-4">
          <Link href="/dashboard/clients" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour aux clients
          </Link>
        </div>

        {/* Tabs */}
        <div className="border-t border-white/60 bg-white/40 px-6">
          <nav className="flex gap-1 -mb-px">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  tab === t.id
                    ? 'border-auchu-500 text-auchu-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ─── Tab: Vue d'ensemble ─────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-3 gap-5">
          {/* Left — contact + brand info */}
          <div className="col-span-2 space-y-5">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Informations</h2>
                {editing ? (
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="btn-secondary py-1.5 text-sm gap-1">
                      <X className="w-3.5 h-3.5" /> Annuler
                    </button>
                    <button onClick={saveOverview} disabled={saving === 'overview'} className="btn-primary py-1.5 text-sm gap-1 disabled:opacity-50">
                      {saving === 'overview' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Sauvegarder
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditing(true)} className="btn-secondary py-1.5 text-sm gap-1">
                    <Pencil className="w-3.5 h-3.5" /> Modifier
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Nom</label>
                      <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="input text-sm" />
                    </div>
                    <div>
                      <label className="label">Statut</label>
                      <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Client['status'] }))} className="select text-sm">
                        <option value="prospect">Prospect</option>
                        <option value="actif">Actif</option>
                        <option value="inactif">Inactif</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="input text-sm" />
                    </div>
                    <div>
                      <label className="label">Téléphone</label>
                      <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="input text-sm" />
                    </div>
                    <div>
                      <label className="label">Entreprise</label>
                      <input type="text" value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} className="input text-sm" />
                    </div>
                    <div>
                      <label className="label">Secteur</label>
                      <input type="text" value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))} className="input text-sm" />
                    </div>
                    <div>
                      <label className="label">Budget mensuel ($)</label>
                      <input type="number" value={editForm.monthly_budget} onChange={e => setEditForm(f => ({ ...f, monthly_budget: e.target.value }))} className="input text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Plateformes</label>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {PLATFORMS.map(p => (
                        <label key={p} className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all select-none',
                          editForm.platforms.includes(p)
                            ? 'bg-auchu-50 border-auchu-300 text-auchu-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        )}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={editForm.platforms.includes(p)}
                            onChange={e => setEditForm(f => ({
                              ...f,
                              platforms: e.target.checked
                                ? [...f.platforms, p]
                                : f.platforms.filter(x => x !== p),
                            }))}
                          />
                          {PLATFORM_LABELS[p]}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Ton de marque</label>
                    <textarea rows={2} value={editForm.brand_tone} onChange={e => setEditForm(f => ({ ...f, brand_tone: e.target.value }))} className="input text-sm resize-none" />
                  </div>
                  <div>
                    <label className="label">Notes de marque</label>
                    <textarea rows={3} value={editForm.brand_notes} onChange={e => setEditForm(f => ({ ...f, brand_notes: e.target.value }))} className="input text-sm resize-none" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <InfoRow label="Email"    value={client.email} />
                  <InfoRow label="Téléphone" value={client.phone} />
                  <InfoRow label="Entreprise" value={client.company} />
                  <InfoRow label="Secteur"   value={client.industry} />
                  <InfoRow label="Budget"    value={client.monthly_budget ? formatCurrency(client.monthly_budget) : null} />
                  {client.brand_tone && (
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-0.5">Ton de marque</p>
                      <p className="text-sm text-gray-700">{client.brand_tone}</p>
                    </div>
                  )}
                  {client.brand_notes && (
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-0.5">Notes de marque</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{client.brand_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right — internal notes */}
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Notes internes</h2>
                {saving === 'notes' && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
              </div>
              <textarea
                value={notesValue}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Notes privées sur ce client (non visibles dans le portail)..."
                rows={10}
                className="input text-sm resize-none w-full"
              />
              <p className="text-xs text-gray-400 mt-1.5">Sauvegarde automatique</p>
            </div>

            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Couleurs de marque</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ background: client.brand_primary }} />
                  <div>
                    <p className="text-xs font-medium text-gray-700">Couleur principale</p>
                    <p className="text-xs text-gray-400 font-mono">{client.brand_primary}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ background: client.brand_secondary }} />
                  <div>
                    <p className="text-xs font-medium text-gray-700">Couleur secondaire</p>
                    <p className="text-xs text-gray-400 font-mono">{client.brand_secondary}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab: Projets ────────────────────────────────────────────────────── */}
      {tab === 'projects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{projects.length} projet{projects.length !== 1 ? 's' : ''}</p>
            <Link href={`/dashboard/projets`} className="btn-secondary text-sm gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Nouveau projet
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="card text-center py-12">
              <FolderKanban className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucun projet pour ce client</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map(p => (
                <div key={p.id} className="card py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                    {p.deadline && (
                      <p className="text-xs text-gray-400 mt-0.5">Échéance : {formatDate(p.deadline)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {p.priority !== 'normale' && (
                      <span className={cn('text-xs font-medium', PRIORITY_COLORS[p.priority])}>
                        {PRIORITY_LABELS[p.priority]}
                      </span>
                    )}
                    <span className={cn('badge text-xs', PROJECT_STATUS_COLORS[p.status])}>
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Contenu ────────────────────────────────────────────────────── */}
      {tab === 'content' && (
        <ContentCalendar content={content} />
      )}

      {/* ─── Tab: Factures ───────────────────────────────────────────────────── */}
      {tab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {invoices.length} facture{invoices.length !== 1 ? 's' : ''} · {' '}
              <span className="font-medium text-gray-700">
                {formatCurrency(invoices.filter(i => i.status === 'paye').reduce((s, i) => s + i.total, 0))} encaissé
              </span>
            </p>
            <Link href="/dashboard/finance/factures/nouvelle" className="btn-primary text-sm gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Nouvelle facture
            </Link>
          </div>

          {invoices.length === 0 ? (
            <div className="card text-center py-12">
              <CreditCard className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucune facture pour ce client</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Date</th>
                    <th className="text-right">HT</th>
                    <th className="text-right">TTC</th>
                    <th>Statut</th>
                    <th>Échéance</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const cfg = STATUS_CONFIG[inv.status as keyof typeof STATUS_CONFIG]
                    return (
                      <tr key={inv.id}>
                        <td>
                          <Link href={`/dashboard/finance/factures/${inv.id}`} className="text-sm font-medium text-auchu-600 hover:underline">
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td className="text-xs text-gray-400">{formatDate(inv.created_at)}</td>
                        <td className="text-right tabular-nums text-sm text-gray-600">{formatCurrency(inv.subtotal)}</td>
                        <td className="text-right tabular-nums text-sm font-medium text-gray-900">{formatCurrency(inv.total)}</td>
                        <td><span className={cn('badge', cfg?.cls)}>{cfg?.label}</span></td>
                        <td className="text-xs text-gray-400">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Portail ────────────────────────────────────────────────────── */}
      {tab === 'portal' && (
        <PortalTab
          client={client}
          portalUrl={portalUrl}
          copied={copied}
          generatingPortal={generatingPortal}
          accentBg={accentBg}
          projects={projects}
          invoices={invoices}
          onGenerate={generatePortal}
          onRevoke={revokePortal}
          onCopy={copyPortalUrl}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer group" title={label}>
      <div
        className="w-6 h-6 rounded-md border-2 border-white shadow-sm group-hover:scale-110 transition-transform"
        style={{ background: value }}
      />
      <span className="text-xs text-gray-500 hidden group-hover:block absolute mt-8 bg-gray-800 text-white px-2 py-1 rounded text-[10px]">
        {label}
      </span>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="sr-only"
      />
    </label>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-baseline gap-3">
      <p className="text-xs text-gray-400 font-medium w-24 flex-shrink-0">{label}</p>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  )
}

function ContentCalendar({ content }: { content: ContentPiece[] }) {
  const [viewDate, setViewDate] = useState(new Date())

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  const DAYS   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

  // Build calendar grid
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Mon = 0

  const cells: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  // Group content by day
  const byDay: Record<string, ContentPiece[]> = {}
  content.forEach(c => {
    if (!c.scheduled_at) return
    const key = new Date(c.scheduled_at).toDateString()
    if (!byDay[key]) byDay[key] = []
    byDay[key].push(c)
  })

  const today = new Date().toDateString()

  return (
    <div className="space-y-4">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            ←
          </button>
          <button
            onClick={() => setViewDate(new Date())}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            →
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="card p-0 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="min-h-[80px] bg-gray-50/50" />

            const key      = date.toDateString()
            const dayItems = byDay[key] ?? []
            const isToday  = key === today

            return (
              <div
                key={i}
                className={cn(
                  'min-h-[80px] p-1.5 relative',
                  isToday && 'bg-auchu-50/40'
                )}
              >
                <span className={cn(
                  'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full',
                  isToday ? 'bg-auchu-500 text-white' : 'text-gray-500'
                )}>
                  {date.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayItems.slice(0, 3).map(item => (
                    <div
                      key={item.id}
                      className={cn(
                        'text-[10px] px-1 py-0.5 rounded truncate font-medium',
                        CONTENT_PLATFORM_COLORS[item.platform] ?? 'bg-gray-100 text-gray-600'
                      )}
                      title={item.title}
                    >
                      {item.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <div className="text-[10px] text-gray-400 pl-1">+{dayItems.length - 3}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      {content.length === 0 && (
        <div className="card text-center py-10">
          <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Aucun contenu planifié ce mois</p>
        </div>
      )}
    </div>
  )
}

function PortalTab({
  client, portalUrl, copied, generatingPortal, accentBg,
  projects, invoices, onGenerate, onRevoke, onCopy,
}: {
  client: Client
  portalUrl: string | null
  copied: boolean
  generatingPortal: boolean
  accentBg: string
  projects: Project[]
  invoices: Invoice[]
  onGenerate: () => void
  onRevoke: () => void
  onCopy: () => void
}) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left — controls */}
      <div className="space-y-4">
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Lien de partage</h3>

          {portalUrl ? (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-600 font-mono truncate flex-1">{portalUrl}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onCopy} className="btn-primary flex-1 gap-1.5 text-sm justify-center">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copié !' : 'Copier le lien'}
                </button>
                <button
                  onClick={() => window.open(portalUrl, '_blank')}
                  className="btn-secondary gap-1.5 text-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
              <button onClick={onRevoke} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                Révoquer l'accès au portail
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <Globe className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">Le portail client n'est pas encore activé</p>
              <button
                onClick={onGenerate}
                disabled={generatingPortal}
                className="btn-primary gap-1.5 disabled:opacity-50"
              >
                {generatingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                Activer le portail client
              </button>
            </div>
          )}
        </div>

        <div className="card text-sm text-gray-600 space-y-2">
          <p className="font-medium text-gray-800">Ce que voit le client :</p>
          <ul className="space-y-1 text-gray-500">
            <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Ses projets actifs et leurs statuts</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Ses factures et montants</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Le contenu planifié</li>
            <li className="flex items-center gap-2"><X className="w-3.5 h-3.5 text-red-400" /> Notes internes (jamais visibles)</li>
          </ul>
        </div>
      </div>

      {/* Right — portal preview */}
      <div>
        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Aperçu du portail</p>
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Portal mini header */}
          <div className="p-4" style={{ background: `linear-gradient(135deg, ${client.brand_primary}, ${client.brand_secondary})` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                {client.logo_url ? (
                  <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-white font-bold text-sm">{getInitials(client.name)}</span>
                )}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{client.name}</p>
                <p className="text-white/70 text-xs">Portail client</p>
              </div>
            </div>
          </div>

          {/* Portal mini content */}
          <div className="p-4 bg-gray-50 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Projets actifs</p>
              {projects.filter(p => p.status !== 'termine' && p.status !== 'annule').slice(0, 2).map(p => (
                <div key={p.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2 mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-700 truncate">{p.title}</p>
                  <span className={cn('badge text-[10px]', PROJECT_STATUS_COLORS[p.status])}>
                    {PROJECT_STATUS_LABELS[p.status]}
                  </span>
                </div>
              ))}
              {projects.filter(p => p.status !== 'termine' && p.status !== 'annule').length === 0 && (
                <p className="text-xs text-gray-400">Aucun projet actif</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Dernières factures</p>
              {invoices.slice(0, 2).map(inv => {
                const cfg = STATUS_CONFIG[inv.status as keyof typeof STATUS_CONFIG]
                return (
                  <div key={inv.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2 mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-700">{inv.invoice_number}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">{formatCurrency(inv.total)}</span>
                      <span className={cn('badge text-[10px]', cfg?.cls)}>{cfg?.label}</span>
                    </div>
                  </div>
                )
              })}
              {invoices.length === 0 && (
                <p className="text-xs text-gray-400">Aucune facture</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
