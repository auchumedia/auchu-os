'use client'

import { useState } from 'react'
import { Sparkles, Copy, RefreshCw, Check } from 'lucide-react'

const MODES = [
  { id: 'social', label: 'Post social', icon: '📱' },
  { id: 'ads', label: 'Copy pub', icon: '🎯' },
  { id: 'caption', label: 'Caption photo', icon: '📸' },
  { id: 'script', label: 'Script vidéo', icon: '🎬' },
  { id: 'email', label: 'Infolettre', icon: '📧' },
]

const TONES = ['Pro', 'Décontracté', 'Humoristique', 'Inspirant', 'Urgence']
const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Google Ads', 'Meta Ads']

interface Variant {
  label: string
  body: string
}

export default function AgentContenuPage() {
  const [mode, setMode] = useState('social')
  const [clientName, setClientName] = useState('')
  const [brief, setBrief] = useState('')
  const [tone, setTone] = useState('Pro')
  const [platform, setPlatform] = useState('Instagram')
  const [language, setLanguage] = useState('Français')
  const [loading, setLoading] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  async function generate() {
    if (!clientName.trim() || !brief.trim()) {
      setError('Remplis le nom du client et le brief.')
      return
    }
    setError(null)
    setLoading(true)
    setVariants([])

    try {
      const res = await fetch('/api/agents/contenu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, clientName, brief, tone, platform, language }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setVariants(data.variants)
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la génération.')
    }
    setLoading(false)
  }

  async function copyVariant(text: string, idx: number) {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-auchu-100 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-auchu-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent contenu</h1>
        </div>
        <p className="text-sm text-gray-500">Génère du contenu professionnel pour tes clients en secondes</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Formulaire */}
        <div className="col-span-2 space-y-5">
          {/* Modes */}
          <div className="card">
            <label className="label">Type de contenu</label>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    mode === m.id
                      ? 'bg-auchu-50 border-auchu-300 text-auchu-700 font-medium'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span>{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Champs */}
          <div className="card space-y-4">
            <div>
              <label className="label">Client / marque</label>
              <input
                className="input"
                placeholder="ex: Café Nouveau, Restaurant Bella..."
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Brief</label>
              <textarea
                className="textarea"
                rows={4}
                placeholder="Décris ce que tu veux communiquer... ex: lancement d'un nouveau menu, promo 20%, ouverture d'un nouveau local..."
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Plateforme</label>
                <select className="select" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Langue</label>
                <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option>Français</option>
                  <option>English</option>
                  <option>Bilingue</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button onClick={generate} disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading ? <span className="spinner" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'L\'agent rédige...' : 'Générer le contenu'}
          </button>
        </div>

        {/* Ton sidebar */}
        <div>
          <div className="card">
            <label className="label">Ton de la marque</label>
            <div className="space-y-1.5">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    tone === t
                      ? 'bg-auchu-50 text-auchu-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Résultats */}
      {variants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{variants.length} variantes générées</h2>
            <button onClick={generate} className="btn-ghost text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
              Régénérer
            </button>
          </div>

          {variants.map((v, i) => (
            <div key={i} className="card relative">
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className={`badge text-xs ${
                  i === 0 ? 'badge-blue' : i === 1 ? 'badge-green' : 'badge-purple'
                }`}>
                  Option {i + 1}
                </span>
                <button
                  onClick={() => copyVariant(v.body, i)}
                  className="btn-ghost text-xs py-1 px-2 flex-shrink-0"
                >
                  {copiedIdx === i ? (
                    <><Check className="w-3.5 h-3.5 text-green-600" /> Copié</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copier</>
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{v.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
