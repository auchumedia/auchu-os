'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Camera, ExternalLink, Copy, Check, Plus, Loader2,
  Calendar, FileText, CreditCard, Globe, Pencil,
  Save, X, CheckCircle, Eye, EyeOff, Upload, Download, Trash2,
  Instagram, Facebook, Linkedin,
} from 'lucide-react'
import { Client, Invoice, ContentPiece, CalendarEvent, ClientPlatformAccess, ClientDocument } from '@/types'
import ContentTable from './ContentTable'
import CalendarView from './CalendarView'
import { cn, formatCurrency, formatDate, getInitials } from '@/lib/utils'

// ─── Config ───────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'content' | 'calendar' | 'invoices' | 'portal'

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'google', 'meta']

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  linkedin: 'LinkedIn', google: 'Google Ads', meta: 'Meta Ads',
}

const INVOICE_STATUS_CONFIG = {
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

type LinkPlatformKey = 'link_instagram' | 'link_facebook' | 'link_tiktok' | 'link_linkedin'
interface LinkPlatformCfg { key: LinkPlatformKey; label: string; icon?: React.ElementType; emoji?: string; color: string }
const LINK_PLATFORMS: LinkPlatformCfg[] = [
  { key: 'link_instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-600' },
  { key: 'link_facebook',  label: 'Facebook',  icon: Facebook,  color: 'text-blue-600' },
  { key: 'link_tiktok',    label: 'TikTok',     emoji: '🎵',     color: 'text-gray-900' },
  { key: 'link_linkedin',  label: 'LinkedIn',   icon: Linkedin,  color: 'text-sky-600' },
]

type AccessPlatformKey = 'instagram' | 'facebook' | 'tiktok' | 'linkedin'
interface AccessPlatformCfg { key: AccessPlatformKey; label: string; icon?: React.ElementType; emoji?: string }
const ACCESS_PLATFORMS: AccessPlatformCfg[] = [
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'facebook',  label: 'Facebook',  icon: Facebook },
  { key: 'tiktok',    label: 'TikTok',    emoji: '🎵' },
  { key: 'linkedin',  label: 'LinkedIn',  icon: Linkedin },
]

const MAX_DOCUMENTS = 10

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  client:   Client
  invoices: Invoice[]
  content:  ContentPiece[]
  events:   CalendarEvent[]
  teamMembers: { id: string; name: string }[]
  canManageSensitive: boolean
  platformAccess: ClientPlatformAccess | null
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientDetail({
  client: initial, invoices, content, events, teamMembers,
  canManageSensitive, platformAccess: initialPlatformAccess,
}: Props) {
  const [tab, setTab]       = useState<Tab>('overview')
  const [client, setClient] = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Logo
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Portal
  const [generatingPortal, setGeneratingPortal] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)

  useEffect(() => {
    if (client.portal_token) {
      setPortalUrl(`${window.location.origin}/portail/${client.portal_token}`)
    }
  }, [client.portal_token])

  // Notes
  const [notesValue, setNotesValue]   = useState(client.internal_notes ?? '')
  const notesTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Overview edit
  const [editing, setEditing] = useState(false)
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

  // Livrables du mois
  const [deliverables, setDeliverables] = useState({
    video_organique: client.deliverables_video_organique,
    story:           client.deliverables_story,
    ad:              client.deliverables_ad,
  })
  const [savingDeliverables, setSavingDeliverables] = useState(false)
  const deliverablesTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Liens plateformes
  const [editingLinks, setEditingLinks] = useState(false)
  const [linksForm, setLinksForm] = useState({
    link_instagram: client.link_instagram ?? '',
    link_facebook:  client.link_facebook  ?? '',
    link_tiktok:    client.link_tiktok    ?? '',
    link_linkedin:  client.link_linkedin  ?? '',
  })

  // Accès plateformes (owner/director uniquement)
  const [platformAccess, setPlatformAccess] = useState(initialPlatformAccess)
  const [editingAccess, setEditingAccess] = useState(false)
  const [savingAccess, setSavingAccess] = useState(false)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({})
  const [accessForm, setAccessForm] = useState({
    instagram_email:    platformAccess?.instagram_email    ?? '',
    instagram_password:  platformAccess?.instagram_password ?? '',
    facebook_email:      platformAccess?.facebook_email     ?? '',
    facebook_password:   platformAccess?.facebook_password  ?? '',
    tiktok_email:        platformAccess?.tiktok_email       ?? '',
    tiktok_password:     platformAccess?.tiktok_password    ?? '',
    linkedin_email:      platformAccess?.linkedin_email     ?? '',
    linkedin_password:   platformAccess?.linkedin_password  ?? '',
    notes:               platformAccess?.notes              ?? '',
  })

  // Documents (owner/director uniquement)
  const [documents, setDocuments]       = useState<ClientDocument[]>([])
  const [loadingDocs, setLoadingDocs]   = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docsError, setDocsError]       = useState<string | null>(null)
  const docsFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!canManageSensitive) return
    setLoadingDocs(true)
    fetch(`/api/clients/${client.id}/documents`)
      .then(r => r.json())
      .then(json => setDocuments(json.data ?? []))
      .finally(() => setLoadingDocs(false))
  }, [canManageSensitive, client.id])

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const [patchError, setPatchError] = useState<string | null>(null)

  // Retourne le client mis à jour en cas de succès, ou null en cas d'échec —
  // les appelants doivent vérifier le retour avant de considérer une
  // sauvegarde comme acquise (ex: ne pas quitter le mode édition sur échec).
  const patch = useCallback(async (fields: Partial<Client>): Promise<Client | null> => {
    setPatchError(null)
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
    const json = await res.json().catch(() => null)
    console.error('[ClientDetail] patch échoué —', 'fields:', Object.keys(fields), '| status:', res.status, '| body:', json)
    setPatchError(json?.error ?? `Erreur ${res.status} lors de la sauvegarde`)
    return null
  }, [client.id])

  const saveColor = (field: 'brand_primary' | 'brand_secondary', value: string) => {
    setClient(c => ({ ...c, [field]: value }))
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => patch({ [field]: value }), 600)
  }

  const handleNotesChange = (value: string) => {
    setNotesValue(value)
    if (notesTimeout.current) clearTimeout(notesTimeout.current)
    notesTimeout.current = setTimeout(async () => {
      setSaving('notes')
      await patch({ internal_notes: value })
      setSaving(null)
    }, 800)
  }

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

  const saveOverview = async () => {
    setSaving('overview')
    const result = await patch({
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
    if (result) setEditing(false) // reste en édition si la sauvegarde a échoué
  }

  // ─── Livrables du mois ───────────────────────────────────────────────────────

  const handleDeliverableChange = (field: 'video_organique' | 'story' | 'ad', value: number) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
    setDeliverables(prev => {
      const next = { ...prev, [field]: safeValue }
      if (deliverablesTimeout.current) clearTimeout(deliverablesTimeout.current)
      deliverablesTimeout.current = setTimeout(async () => {
        setSavingDeliverables(true)
        await patch({
          deliverables_video_organique: next.video_organique,
          deliverables_story:           next.story,
          deliverables_ad:              next.ad,
        })
        setSavingDeliverables(false)
      }, 700)
      return next
    })
  }

  const deliverablesTotal = deliverables.video_organique + deliverables.story + deliverables.ad

  // ─── Liens plateformes ───────────────────────────────────────────────────────

  const saveLinks = async () => {
    setSaving('links')
    const result = await patch({
      link_instagram: linksForm.link_instagram || null,
      link_facebook:  linksForm.link_facebook  || null,
      link_tiktok:    linksForm.link_tiktok    || null,
      link_linkedin:  linksForm.link_linkedin  || null,
    })
    setSaving(null)
    if (result) setEditingLinks(false) // reste en édition si la sauvegarde a échoué
  }

  // ─── Accès plateformes ───────────────────────────────────────────────────────

  const [accessError, setAccessError] = useState<string | null>(null)

  const saveAccess = async () => {
    setSavingAccess(true)
    setAccessError(null)
    const res = await fetch(`/api/clients/${client.id}/access`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accessForm),
    })
    if (res.ok) {
      const { data } = await res.json()
      setPlatformAccess(data)
      setEditingAccess(false) // seulement en cas de succès
    } else {
      const json = await res.json().catch(() => null)
      console.error('[ClientDetail] access patch échoué —', 'status:', res.status, '| body:', json)
      setAccessError(json?.error ?? `Erreur ${res.status} lors de la sauvegarde`)
    }
    setSavingAccess(false)
  }

  const togglePasswordVisibility = (key: string) =>
    setRevealedPasswords(p => ({ ...p, [key]: !p[key] }))

  // ─── Documents ───────────────────────────────────────────────────────────────

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(true)
    setDocsError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/clients/${client.id}/documents`, { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) {
      setDocsError(json.error ?? 'Erreur lors du téléversement')
    } else {
      setDocuments(prev => [json.data, ...prev])
    }
    setUploadingDoc(false)
    if (docsFileInputRef.current) docsFileInputRef.current.value = ''
  }

  const deleteDocument = async (docId: string) => {
    if (!confirm('Supprimer ce document ?')) return
    await fetch(`/api/clients/${client.id}/documents/${docId}`, { method: 'DELETE' })
    setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  // ─── Portal ────────────────────────────────────────────────────────────────

  const generatePortal = async () => {
    setGeneratingPortal(true)
    setPortalError(null)
    try {
      const res = await fetch(`/api/clients/${client.id}/portal`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setPortalError(json.error ?? `Erreur ${res.status}`)
      } else {
        setPortalUrl(`${window.location.origin}/portail/${json.token}`)
        setClient(c => ({ ...c, portal_token: json.token, portal_enabled: true }))
      }
    } catch (e) {
      setPortalError('Erreur réseau — réessaie.')
    } finally {
      setGeneratingPortal(false)
    }
  }

  const revokePortal = async () => {
    const res = await fetch(`/api/clients/${client.id}/portal`, { method: 'DELETE' })
    if (res.ok) {
      setPortalUrl(null)
      setPortalError(null)
      setClient(c => ({ ...c, portal_token: null, portal_enabled: false }))
    }
  }

  const copyPortalUrl = async () => {
    if (!portalUrl) return
    await navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const headerBg = `linear-gradient(135deg, ${client.brand_primary}18 0%, ${client.brand_secondary}18 100%)`
  const accentBg = `linear-gradient(135deg, ${client.brand_primary}, ${client.brand_secondary})`

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Vue d\'ensemble',              icon: FileText  },
    { id: 'content',   label: `Contenu (${content.length})`,  icon: FileText  },
    { id: 'calendar',  label: 'Calendrier',                   icon: Calendar  },
    { id: 'invoices',  label: `Factures (${invoices.length})`,icon: CreditCard},
    { id: 'portal',    label: 'Portail',                      icon: Globe     },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0">

      {/* ─── Header card ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border border-gray-200 overflow-hidden mb-6"
        style={{ background: headerBg }}
      >
        <div className="px-6 py-5">
          <div className="flex items-start gap-5">

            {/* Logo */}
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
                    <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover" />
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
                }[client.status] ?? 'badge-gray')}>
                  {{ actif: 'Actif', inactif: 'Inactif', prospect: 'Prospect' }[client.status]}
                </span>
              </div>
              {client.company && <p className="text-sm text-gray-500 mt-0.5">{client.company}</p>}
              {client.platforms?.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {client.platforms.map(p => (
                    <span key={p} className="badge badge-gray text-xs">{PLATFORM_LABELS[p] ?? p}</span>
                  ))}
                </div>
              )}
              {client.monthly_budget && (
                <p className="text-sm text-gray-500 mt-1.5">
                  Budget mensuel : <span className="font-semibold text-gray-700">{formatCurrency(client.monthly_budget)}</span>
                </p>
              )}
            </div>

            {/* Right — colors + portal */}
            <div className="flex flex-col items-end gap-3 flex-shrink-0">
              {/* Color pickers — lecture seule pour les rôles non-owner/director */}
              <div className="flex items-center gap-3">
                {canManageSensitive ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-md border-2 border-white shadow-sm" style={{ background: client.brand_primary }} title="Couleur principale" />
                    <div className="w-6 h-6 rounded-md border-2 border-white shadow-sm" style={{ background: client.brand_secondary }} title="Couleur secondaire" />
                  </>
                )}
              </div>

              {/* Portal — inline URL when active */}
              {portalUrl ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 px-3 py-2 max-w-[220px]">
                    <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs font-mono text-gray-500 truncate">{portalUrl}</span>
                  </div>
                  <button
                    onClick={copyPortalUrl}
                    title="Copier le lien"
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all',
                      copied
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-white/80 border-gray-200 text-gray-700 hover:border-gray-300'
                    )}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                  <button
                    onClick={() => window.open(portalUrl, '_blank')}
                    title="Ouvrir le portail"
                    className="p-2 rounded-xl border border-gray-200 bg-white/80 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-end gap-1.5">
                  <button
                    onClick={generatePortal}
                    disabled={generatingPortal}
                    className="btn-primary text-sm gap-1.5 disabled:opacity-50"
                    style={{ background: accentBg, border: 'none' }}
                  >
                    {generatingPortal
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Globe className="w-3.5 h-3.5" />}
                    Générer un lien portail
                  </button>
                  {portalError && (
                    <p className="text-xs text-red-600 bg-white/90 rounded-lg px-2 py-1 max-w-[280px] text-right">
                      {portalError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Back */}
        <div className="px-6 pb-3">
          <Link href="/dashboard/clients" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour aux clients
          </Link>
        </div>

        {/* Tab nav */}
        <div className="border-t border-white/60 bg-white/40 px-6 overflow-x-auto scrollbar-hide">
          <nav className="flex gap-1 -mb-px min-w-max">
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
        <div className="space-y-4">
          {patchError && (
            <div className="card bg-red-50 border-red-200 py-3 text-sm text-red-600">
              {patchError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className={cn(canManageSensitive ? 'md:col-span-2' : 'md:col-span-3', 'space-y-5')}>
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Informations</h2>
                {canManageSensitive && (
                  editing ? (
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
                  )
                )}
              </div>

              {!canManageSensitive ? (
                <div className="space-y-3">
                  <InfoRow label="Nom"        value={client.name} />
                  <InfoRow label="Statut"     value={{ actif: 'Actif', inactif: 'Inactif', prospect: 'Prospect' }[client.status]} />
                  <InfoRow label="Plateformes" value={client.platforms?.length > 0 ? client.platforms.map(p => PLATFORM_LABELS[p] ?? p).join(', ') : null} />
                </div>
              ) : editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <InfoRow label="Email"       value={client.email} />
                  <InfoRow label="Téléphone"   value={client.phone} />
                  <InfoRow label="Entreprise"  value={client.company} />
                  <InfoRow label="Secteur"     value={client.industry} />
                  <InfoRow label="Budget"      value={client.monthly_budget ? formatCurrency(client.monthly_budget) : null} />
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

            {/* ─── Livrables du mois ───────────────────────────────────────── */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Livrables du mois</h2>
                {savingDeliverables && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
              </div>
              {canManageSensitive ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Vidéo organique</label>
                    <input
                      type="number" min={0}
                      value={deliverables.video_organique}
                      onChange={e => handleDeliverableChange('video_organique', Number(e.target.value))}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="label">Story</label>
                    <input
                      type="number" min={0}
                      value={deliverables.story}
                      onChange={e => handleDeliverableChange('story', Number(e.target.value))}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="label">Ad</label>
                    <input
                      type="number" min={0}
                      value={deliverables.ad}
                      onChange={e => handleDeliverableChange('ad', Number(e.target.value))}
                      className="input text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <InfoRow label="Vidéo organique" value={String(deliverables.video_organique)} />
                  <InfoRow label="Story"           value={String(deliverables.story)} />
                  <InfoRow label="Ad"              value={String(deliverables.ad)} />
                </div>
              )}
              <p className="text-sm text-gray-500 mt-3">
                Total : <span className="font-semibold text-gray-900">{deliverablesTotal}</span> livrable{deliverablesTotal !== 1 ? 's' : ''} / mois
              </p>
              <p className="text-xs text-gray-400 mt-1">Affiché dans le portail client comme "Contenu du mois"</p>
            </div>

            {/* ─── Liens plateformes ───────────────────────────────────────── */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Liens plateformes</h2>
                {canManageSensitive && (
                  editingLinks ? (
                    <div className="flex gap-2">
                      <button onClick={() => setEditingLinks(false)} className="btn-secondary py-1.5 text-sm gap-1">
                        <X className="w-3.5 h-3.5" /> Annuler
                      </button>
                      <button onClick={saveLinks} disabled={saving === 'links'} className="btn-primary py-1.5 text-sm gap-1 disabled:opacity-50">
                        {saving === 'links' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Sauvegarder
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingLinks(true)} className="btn-secondary py-1.5 text-sm gap-1">
                      <Pencil className="w-3.5 h-3.5" /> Modifier
                    </button>
                  )
                )}
              </div>

              {canManageSensitive && editingLinks ? (
                <div className="space-y-3">
                  {LINK_PLATFORMS.map(p => (
                    <div key={p.key}>
                      <label className="label flex items-center gap-1.5">
                        {p.icon ? <p.icon className={cn('w-3.5 h-3.5', p.color)} /> : <span>{p.emoji}</span>}
                        {p.label}
                      </label>
                      <input
                        type="url"
                        value={linksForm[p.key]}
                        onChange={e => setLinksForm(f => ({ ...f, [p.key]: e.target.value }))}
                        placeholder="https://…"
                        className="input text-sm"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {LINK_PLATFORMS.filter(p => client[p.key]).map(p => (
                    <a
                      key={p.key}
                      href={client[p.key]!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-700 hover:text-auchu-600 transition-colors"
                    >
                      {p.icon ? <p.icon className={cn('w-4 h-4', p.color)} /> : <span>{p.emoji}</span>}
                      <span className="truncate">{p.label}</span>
                      <ExternalLink className="w-3 h-3 text-gray-300 flex-shrink-0" />
                    </a>
                  ))}
                  {LINK_PLATFORMS.every(p => !client[p.key]) && (
                    <p className="text-xs text-gray-300 italic">Aucun lien renseigné</p>
                  )}
                </div>
              )}
            </div>

            {/* ─── Accès plateformes (owner/director) ──────────────────────── */}
            {canManageSensitive && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Accès plateformes</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Visible uniquement par owner et director</p>
                  </div>
                  {editingAccess ? (
                    <div className="flex gap-2">
                      <button onClick={() => setEditingAccess(false)} className="btn-secondary py-1.5 text-sm gap-1">
                        <X className="w-3.5 h-3.5" /> Annuler
                      </button>
                      <button onClick={saveAccess} disabled={savingAccess} className="btn-primary py-1.5 text-sm gap-1 disabled:opacity-50">
                        {savingAccess ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Sauvegarder
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingAccess(true)} className="btn-secondary py-1.5 text-sm gap-1">
                      <Pencil className="w-3.5 h-3.5" /> Modifier
                    </button>
                  )}
                </div>

                {accessError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{accessError}</p>
                )}

                <div className="space-y-3">
                  {ACCESS_PLATFORMS.map(p => {
                    const emailKey    = `${p.key}_email`    as keyof typeof accessForm
                    const passwordKey = `${p.key}_password` as keyof typeof accessForm
                    const revealed    = !!revealedPasswords[p.key]
                    return (
                      <div key={p.key} className="border border-gray-100 rounded-xl p-3">
                        <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mb-2">
                          {p.icon ? <p.icon className="w-3.5 h-3.5" /> : <span>{p.emoji}</span>}
                          {p.label}
                        </p>
                        {editingAccess ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="email"
                              value={accessForm[emailKey]}
                              onChange={e => setAccessForm(f => ({ ...f, [emailKey]: e.target.value }))}
                              placeholder="Email de connexion"
                              className="input text-sm"
                            />
                            <div className="relative">
                              <input
                                type={revealed ? 'text' : 'password'}
                                value={accessForm[passwordKey]}
                                onChange={e => setAccessForm(f => ({ ...f, [passwordKey]: e.target.value }))}
                                placeholder="Mot de passe"
                                className="input text-sm pr-9"
                              />
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(p.key)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>{accessForm[emailKey] || '—'}</span>
                            {accessForm[passwordKey] && (
                              <span className="flex items-center gap-1.5 font-mono">
                                {revealed ? accessForm[passwordKey] : '••••••••'}
                                <button type="button" onClick={() => togglePasswordVisibility(p.key)} className="text-gray-400 hover:text-gray-600">
                                  {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div>
                    <label className="label">Notes d&apos;accès supplémentaires</label>
                    {editingAccess ? (
                      <textarea
                        rows={3}
                        value={accessForm.notes}
                        onChange={e => setAccessForm(f => ({ ...f, notes: e.target.value }))}
                        className="input text-sm resize-none"
                        placeholder="2FA, questions de sécurité, contact technique…"
                      />
                    ) : (
                      <p className="text-sm text-gray-600 whitespace-pre-line">{accessForm.notes || '—'}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Documents (owner/director) ──────────────────────────────── */}
            {canManageSensitive && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Documents
                    <span className="ml-1.5 font-normal text-gray-400">({documents.length}/{MAX_DOCUMENTS})</span>
                  </h2>
                  <button
                    onClick={() => docsFileInputRef.current?.click()}
                    disabled={uploadingDoc || documents.length >= MAX_DOCUMENTS}
                    className="btn-secondary py-1.5 text-sm gap-1 disabled:opacity-50"
                  >
                    {uploadingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Ajouter un PDF
                  </button>
                  <input
                    ref={docsFileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleDocUpload}
                  />
                </div>

                {docsError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{docsError}</p>}

                {loadingDocs ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
                ) : documents.length === 0 ? (
                  <p className="text-sm text-gray-300 italic text-center py-4">Aucun document</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-400">{formatDate(doc.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-auchu-600 hover:bg-gray-50 transition-colors"
                              title="Télécharger"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => deleteDocument(doc.id)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {canManageSensitive && (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-900">Notes internes</h2>
                  {saving === 'notes' && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
                </div>
                <textarea
                  value={notesValue}
                  onChange={e => handleNotesChange(e.target.value)}
                  placeholder="Notes privées — jamais visibles dans le portail client..."
                  rows={10}
                  className="input text-sm resize-none w-full"
                />
                <p className="text-xs text-gray-400 mt-1.5">Sauvegarde automatique</p>
              </div>

              <div className="card">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Couleurs de marque</h2>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: client.brand_primary }} />
                    <div>
                      <p className="text-xs font-medium text-gray-700">Principale</p>
                      <p className="text-xs text-gray-400 font-mono">{client.brand_primary}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: client.brand_secondary }} />
                    <div>
                      <p className="text-xs font-medium text-gray-700">Secondaire</p>
                      <p className="text-xs text-gray-400 font-mono">{client.brand_secondary}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 pt-1">Modifiables via les pastilles dans le header</p>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* ─── Tab: Contenu (table Notion) ─────────────────────────────────────── */}
      {tab === 'content' && (
        <ContentTable initialContent={content} clientId={client.id} teamMembers={teamMembers} />
      )}

      {/* ─── Tab: Calendrier ─────────────────────────────────────────────────── */}
      {tab === 'calendar' && (
        <CalendarView
          initialEvents={events}
          contentPieces={content}
          clientId={client.id}
        />
      )}

      {/* ─── Tab: Factures ───────────────────────────────────────────────────── */}
      {tab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {invoices.length} facture{invoices.length !== 1 ? 's' : ''} ·{' '}
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
              <div className="overflow-x-auto">
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
                      const cfg = INVOICE_STATUS_CONFIG[inv.status as keyof typeof INVOICE_STATUS_CONFIG]
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
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Portail ────────────────────────────────────────────────────── */}
      {tab === 'portal' && (
        <PortalTab
          client={client}
          portalUrl={portalUrl}
          portalError={portalError}
          copied={copied}
          generatingPortal={generatingPortal}
          accentBg={accentBg}
          invoices={invoices}
          onGenerate={generatePortal}
          onRevoke={revokePortal}
          onCopy={copyPortalUrl}
          onOpen={() => portalUrl && window.open(portalUrl, '_blank')}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="cursor-pointer" title={label}>
      <div
        className="w-6 h-6 rounded-md border-2 border-white shadow-sm hover:scale-110 transition-transform"
        style={{ background: value }}
      />
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


function PortalTab({
  client, portalUrl, portalError, copied, generatingPortal, accentBg,
  invoices, onGenerate, onRevoke, onCopy, onOpen,
}: {
  client: Client
  portalUrl: string | null
  portalError: string | null
  copied: boolean
  generatingPortal: boolean
  accentBg: string
  invoices: Invoice[]
  onGenerate: () => void
  onRevoke: () => void
  onCopy: () => void
  onOpen: () => void
}) {
  const INVOICE_STATUS_CONFIG = {
    draft: { label: 'Brouillon', cls: 'badge-gray' },
    envoye: { label: 'Envoyé', cls: 'badge-blue' },
    paye: { label: 'Payé', cls: 'badge-green' },
    en_retard: { label: 'En retard', cls: 'badge-red' },
    annule: { label: 'Annulé', cls: 'badge-gray' },
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left — controls */}
      <div className="space-y-4">
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Lien de partage sécurisé</h3>

          {portalUrl ? (
            <div className="space-y-3">
              {/* URL display */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1 font-medium">Lien unique du portail</p>
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <p className="text-xs font-mono text-gray-700 break-all">{portalUrl}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={onCopy}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-all',
                    copied
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                  )}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copié !' : 'Copier le lien'}
                </button>
                <button onClick={onOpen} className="btn-secondary gap-1.5 text-sm">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ouvrir
                </button>
              </div>

              {/* Mailto shortcut */}
              {client.email && (
                <a
                  href={`mailto:${client.email}?subject=Votre portail ${client.name}&body=Bonjour,%0A%0AVoici votre portail client pour suivre vos projets, contenus et factures :%0A%0A${encodeURIComponent(portalUrl)}%0A%0AN'hésitez pas à le consulter à tout moment.%0A%0ACordialement,`}
                  className="btn-primary w-full justify-center text-sm gap-1.5"
                  style={{ background: accentBg, border: 'none' }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Envoyer par email à {client.name}
                </a>
              )}

              <button onClick={onRevoke} className="text-xs text-red-400 hover:text-red-600 transition-colors w-full text-center pt-1">
                Révoquer l'accès et générer un nouveau lien
              </button>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: accentBg }}>
                <Globe className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">Portail client non activé</p>
              <p className="text-xs text-gray-400 mb-4">Génère un lien unique et sécurisé à partager avec {client.name}</p>
              <button
                onClick={onGenerate}
                disabled={generatingPortal}
                className="btn-primary gap-1.5 disabled:opacity-50"
                style={{ background: accentBg, border: 'none' }}
              >
                {generatingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                Générer un lien portail
              </button>
              {portalError && (
                <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {portalError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <p className="text-sm font-medium text-gray-800 mb-3">Ce que voit le client :</p>
          <ul className="space-y-2">
            {[
              { ok: true,  text: 'Calendrier éditorial du mois' },
              { ok: true,  text: 'Contenus en attente d\'approbation' },
              { ok: true,  text: 'Factures et statuts de paiement' },
              { ok: false, text: 'Notes internes (jamais exposées)' },
              { ok: false, text: 'Accès au dashboard interne' },
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-500">
                {item.ok
                  ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  : <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right — preview */}
      <div>
        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Aperçu du portail</p>
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4" style={{ background: `linear-gradient(135deg, ${client.brand_primary}, ${client.brand_secondary})` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden">
                {client.logo_url
                  ? <img src={client.logo_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-white font-bold text-sm">{getInitials(client.name)}</span>}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{client.name}</p>
                <p className="text-white/70 text-xs">Portail client</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-50 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Calendrier éditorial</p>
              <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-400 italic">
                Contenu planifié du mois…
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Factures</p>
              {invoices.slice(0, 2).map(inv => {
                const cfg = INVOICE_STATUS_CONFIG[inv.status as keyof typeof INVOICE_STATUS_CONFIG]
                return (
                  <div key={inv.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2 mb-1 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-700">{inv.invoice_number}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-700">{formatCurrency(inv.total)}</span>
                      <span className={cn('badge text-[10px]', cfg?.cls)}>{cfg?.label}</span>
                    </div>
                  </div>
                )
              })}
              {invoices.length === 0 && <p className="text-xs text-gray-400">Aucune facture</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
