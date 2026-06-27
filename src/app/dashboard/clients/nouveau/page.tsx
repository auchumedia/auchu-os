'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, User, Mail, Phone, Building2,
  Briefcase, DollarSign, Palette, FileText, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUTS = [
  { value: 'prospect', label: 'Prospect',  description: 'En cours de conversion', color: 'blue'  },
  { value: 'actif',    label: 'Actif',     description: 'Client actuel',           color: 'green' },
  { value: 'inactif',  label: 'Inactif',   description: 'Relation en pause',       color: 'gray'  },
] as const

const PLATEFORMES = [
  { id: 'instagram', label: 'Instagram', bg: 'bg-pink-50',     border: 'border-pink-200',   text: 'text-pink-700',   dot: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  { id: 'facebook',  label: 'Facebook',  bg: 'bg-blue-50',     border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-600' },
  { id: 'tiktok',    label: 'TikTok',    bg: 'bg-slate-50',    border: 'border-slate-200',  text: 'text-slate-700',  dot: 'bg-slate-800' },
  { id: 'linkedin',  label: 'LinkedIn',  bg: 'bg-sky-50',      border: 'border-sky-200',    text: 'text-sky-700',    dot: 'bg-sky-600' },
  { id: 'google',    label: 'Google Ads',bg: 'bg-amber-50',    border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  { id: 'meta',      label: 'Meta Ads',  bg: 'bg-indigo-50',   border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-600' },
] as const

const INDUSTRIES = [
  'Mode & Beauté', 'Restauration & Food', 'Immobilier', 'Santé & Bien-être',
  'Tech & SaaS', 'E-commerce', 'Sport & Fitness', 'Éducation',
  'Finance & Assurance', 'Tourisme & Hôtellerie', 'Art & Culture', 'Autre',
]

// ─── Component ────────────────────────────────────────────────────────────────

type Statut = 'prospect' | 'actif' | 'inactif'

export default function NouveauClientPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    industry: '',
    status: 'prospect' as Statut,
    monthly_budget: '',
    brand_tone: '',
    brand_notes: '',
    platforms: [] as string[],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: string, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }))

  const togglePlatform = (id: string) =>
    set('platforms', form.platforms.includes(id)
      ? form.platforms.filter(p => p !== id)
      : [...form.platforms, id]
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom du client est requis.'); return }
    setError(null)
    setSaving(true)

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        monthly_budget: form.monthly_budget ? Number(form.monthly_budget) : null,
      }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(json.error ?? 'Une erreur est survenue.')
      return
    }

    router.push('/dashboard/clients')
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/clients"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Nouveau client</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ajoute un client à ton portefeuille</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ─── Infos générales ─────────────────────────────────────────────── */}
        <section className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            Informations générales
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nom <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Nom du client ou de l'agence"
                className="input"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> Email
                </span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="contact@exemple.com"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> Téléphone
                </span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+1 514 000 0000"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" /> Entreprise
                </span>
              </label>
              <input
                type="text"
                value={form.company}
                onChange={e => set('company', e.target.value)}
                placeholder="Nom de l'entreprise"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-gray-400" /> Secteur
                </span>
              </label>
              <select
                value={form.industry}
                onChange={e => set('industry', e.target.value)}
                className="select"
              >
                <option value="">Choisir un secteur...</option>
                {INDUSTRIES.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ─── Statut & budget ─────────────────────────────────────────────── */}
        <section className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-400" />
            Profil client
          </h2>

          {/* Statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUTS.map(s => {
                const active = form.status === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set('status', s.value)}
                    className={cn(
                      'relative flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all',
                      active
                        ? s.color === 'blue'  ? 'bg-blue-50  border-blue-300  ring-1 ring-blue-300'
                        : s.color === 'green' ? 'bg-green-50 border-green-300 ring-1 ring-green-300'
                        :                       'bg-gray-100 border-gray-300  ring-1 ring-gray-300'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    {active && (
                      <CheckCircle2 className={cn(
                        'absolute top-2 right-2 w-3.5 h-3.5',
                        s.color === 'blue'  ? 'text-blue-500'
                        : s.color === 'green' ? 'text-green-500'
                        : 'text-gray-500'
                      )} />
                    )}
                    <span className={cn(
                      'text-sm font-medium',
                      active
                        ? s.color === 'blue'  ? 'text-blue-700'
                        : s.color === 'green' ? 'text-green-700'
                        : 'text-gray-700'
                        : 'text-gray-700'
                    )}>
                      {s.label}
                    </span>
                    <span className="text-xs text-gray-400 mt-0.5">{s.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Budget mensuel (CAD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={form.monthly_budget}
                onChange={e => set('monthly_budget', e.target.value)}
                placeholder="0"
                className="input pl-7"
              />
            </div>
          </div>
        </section>

        {/* ─── Plateformes ──────────────────────────────────────────────────── */}
        <section className="card space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Plateformes actives</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sélectionne les plateformes sur lesquelles ce client est présent</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {PLATEFORMES.map(p => {
              const active = form.platforms.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left',
                    active
                      ? `${p.bg} ${p.border} ring-1 ${p.border.replace('border-', 'ring-')}`
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', active ? p.dot : 'bg-gray-300')} />
                  <span className={cn('text-xs font-medium', active ? p.text : 'text-gray-600')}>
                    {p.label}
                  </span>
                  {active && <CheckCircle2 className={cn('w-3 h-3 ml-auto flex-shrink-0', p.text)} />}
                </button>
              )
            })}
          </div>

          {form.platforms.length > 0 && (
            <p className="text-xs text-gray-400">
              {form.platforms.length} plateforme{form.platforms.length > 1 ? 's' : ''} sélectionnée{form.platforms.length > 1 ? 's' : ''}
            </p>
          )}
        </section>

        {/* ─── Identité de marque ───────────────────────────────────────────── */}
        <section className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Palette className="w-4 h-4 text-gray-400" />
            Identité de marque
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Ton de marque
            </label>
            <textarea
              value={form.brand_tone}
              onChange={e => set('brand_tone', e.target.value)}
              placeholder="Ex : Professionnel et inspirant, avec une touche d'humour. Tutoyement. Éviter le jargon technique."
              rows={3}
              className="input resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Décris la voix et le ton à utiliser dans les contenus pour ce client.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-gray-400" /> Notes de marque
              </span>
            </label>
            <textarea
              value={form.brand_notes}
              onChange={e => set('brand_notes', e.target.value)}
              placeholder="Informations supplémentaires : couleurs de marque, sujets à éviter, audience cible, concurrents..."
              rows={4}
              className="input resize-none"
            />
          </div>
        </section>

        {/* ─── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <span className="flex-shrink-0">⚠</span>
            {error}
          </div>
        )}

        {/* ─── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Link href="/dashboard/clients" className="btn-secondary">
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <User className="w-4 h-4" />}
            {saving ? 'Enregistrement...' : 'Créer le client'}
          </button>
        </div>
      </form>
    </div>
  )
}
